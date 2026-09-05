// src/analyzer/codebase/fileIndexer.ts
// ─────────────────────────────────────────────────────────────────────────────
// Parses a TypeScript or JavaScript file using the TypeScript Compiler API.
// Extracts CodeEntities, imports, calls, and heritage relationships.
// Pure Node.js — zero VS Code dependencies (Architectural Law 2).
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';
import { AnalysisResult, ok, err } from '../../core/types/AnalysisResult';
import { CodeEntity, makeEntityId } from '../../core/types/CodeEntity';
import {
  FileIndexResult,
  ImportRecord,
  ImportSpecifierInfo,
  CallRecord,
  HeritageRecord,
} from '../../core/types/FileIndexData';
import { CodeScopeError } from '../../core/errors/CodeScopeError';

export class FileIndexer {
  /**
   * Parses a single file and extracts its syntactic entities and relations.
   */
  public static async indexFile(filePath: string): Promise<AnalysisResult<FileIndexResult>> {
    let content: string;
    try {
      content = await fs.promises.readFile(filePath, 'utf-8');
    } catch (readErr) {
      return err(new CodeScopeError('FILE_READ_ERROR', `Cannot read file: ${filePath}`, readErr));
    }

    try {
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true, // setParentNodes
        this._getScriptKind(filePath),
      );

      const fileName = path.basename(filePath);
      const lineCount = sourceFile.getLineAndCharacterOfPosition(sourceFile.getEnd()).line + 1;

      const fileEntity: CodeEntity = {
        id: makeEntityId(filePath, 'file', fileName),
        name: fileName,
        kind: 'file',
        filePath,
        startLine: 1,
        endLine: lineCount,
        isExported: false,
      };

      const entities: CodeEntity[] = [fileEntity];
      const imports: ImportRecord[] = [];
      const calls: CallRecord[] = [];
      const heritage: HeritageRecord[] = [];

      // Stack to track current function/method scope for call attribution
      const scopeStack: string[] = [fileEntity.id];

      const visit = (node: ts.Node): void => {
        // ── 1. Import Declarations ──────────────────────────────────────────
        if (ts.isImportDeclaration(node)) {
          const moduleSpecifier = ts.isStringLiteral(node.moduleSpecifier)
            ? node.moduleSpecifier.text
            : '';

          if (moduleSpecifier) {
            const specifiers: ImportSpecifierInfo[] = [];
            const importClause = node.importClause;

            if (importClause) {
              // Default import: import foo from 'bar'
              if (importClause.name) {
                specifiers.push({
                  importedName: 'default',
                  localName: importClause.name.text,
                  isDefault: true,
                });
              }

              if (importClause.namedBindings) {
                // Namespace import: import * as foo from 'bar'
                if (ts.isNamespaceImport(importClause.namedBindings)) {
                  specifiers.push({
                    importedName: '*',
                    localName: importClause.namedBindings.name.text,
                    isNamespace: true,
                  });
                }
                // Named imports: import { a, b as c } from 'bar'
                else if (ts.isNamedImports(importClause.namedBindings)) {
                  for (const element of importClause.namedBindings.elements) {
                    specifiers.push({
                      importedName: element.propertyName?.text ?? element.name.text,
                      localName: element.name.text,
                    });
                  }
                }
              }
            }

            const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
            imports.push({
              moduleSpecifier,
              specifiers,
              line: line + 1,
            });
          }
        }

        // ── 2. Function Declarations ────────────────────────────────────────
        else if (ts.isFunctionDeclaration(node)) {
          const fnName = node.name?.text ?? 'anonymous';
          const isExported = this._hasExportModifier(node);
          const { startLine, endLine } = this._getLineRange(sourceFile, node);

          const fnEntity: CodeEntity = {
            id: makeEntityId(filePath, 'function', fnName),
            name: fnName,
            kind: 'function',
            filePath,
            startLine,
            endLine,
            isExported,
          };
          entities.push(fnEntity);

          scopeStack.push(fnEntity.id);
          ts.forEachChild(node, visit);
          scopeStack.pop();
          return;
        }

        // ── 3. Variable Statements (Functions & Exported Variables) ─────────
        else if (ts.isVariableStatement(node)) {
          const isExported = this._hasExportModifier(node);

          for (const decl of node.declarationList.declarations) {
            if (ts.isIdentifier(decl.name)) {
              const varName = decl.name.text;
              const { startLine, endLine } = this._getLineRange(sourceFile, decl);

              if (
                decl.initializer &&
                (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer))
              ) {
                const fnEntity: CodeEntity = {
                  id: makeEntityId(filePath, 'arrow-function', varName),
                  name: varName,
                  kind: 'arrow-function',
                  filePath,
                  startLine,
                  endLine,
                  isExported,
                };
                entities.push(fnEntity);

                scopeStack.push(fnEntity.id);
                ts.forEachChild(decl.initializer, visit);
                scopeStack.pop();
              } else if (isExported) {
                entities.push({
                  id: makeEntityId(filePath, 'variable', varName),
                  name: varName,
                  kind: 'variable',
                  filePath,
                  startLine,
                  endLine,
                  isExported: true,
                });
              }
            }
          }
        }

        // ── 4. Class Declarations ───────────────────────────────────────────
        else if (ts.isClassDeclaration(node)) {
          const className = node.name?.text ?? 'AnonymousClass';
          const isExported = this._hasExportModifier(node);
          const { startLine, endLine } = this._getLineRange(sourceFile, node);

          const classEntity: CodeEntity = {
            id: makeEntityId(filePath, 'class', className),
            name: className,
            kind: 'class',
            filePath,
            startLine,
            endLine,
            isExported,
          };
          entities.push(classEntity);

          // Heritage clauses (extends, implements)
          if (node.heritageClauses) {
            for (const hc of node.heritageClauses) {
              const kind = hc.token === ts.SyntaxKind.ExtendsKeyword ? 'extends' : 'implements';
              for (const type of hc.types) {
                const targetName = type.expression.getText(sourceFile);
                const { line } = sourceFile.getLineAndCharacterOfPosition(type.getStart());
                heritage.push({
                  entityId: classEntity.id,
                  targetName,
                  kind,
                  line: line + 1,
                });
              }
            }
          }

          scopeStack.push(classEntity.id);
          ts.forEachChild(node, visit);
          scopeStack.pop();
          return;
        }

        // ── 5. Class Methods ────────────────────────────────────────────────
        else if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
          const methodName = ts.isConstructorDeclaration(node)
            ? 'constructor'
            : node.name.getText(sourceFile);

          const { startLine, endLine } = this._getLineRange(sourceFile, node);
          const methodEntity: CodeEntity = {
            id: makeEntityId(filePath, 'function', methodName),
            name: methodName,
            kind: 'function',
            filePath,
            startLine,
            endLine,
            isExported: false,
          };
          entities.push(methodEntity);

          scopeStack.push(methodEntity.id);
          ts.forEachChild(node, visit);
          scopeStack.pop();
          return;
        }

        // ── 6. Interface & Type Declarations ────────────────────────────────
        else if (ts.isInterfaceDeclaration(node)) {
          const ifName = node.name.text;
          const { startLine, endLine } = this._getLineRange(sourceFile, node);
          entities.push({
            id: makeEntityId(filePath, 'interface', ifName),
            name: ifName,
            kind: 'interface',
            filePath,
            startLine,
            endLine,
            isExported: this._hasExportModifier(node),
          });
        } else if (ts.isTypeAliasDeclaration(node)) {
          const typeName = node.name.text;
          const { startLine, endLine } = this._getLineRange(sourceFile, node);
          entities.push({
            id: makeEntityId(filePath, 'type', typeName),
            name: typeName,
            kind: 'type',
            filePath,
            startLine,
            endLine,
            isExported: this._hasExportModifier(node),
          });
        }

        // ── 7. Enum Declarations ────────────────────────────────────────────
        else if (ts.isEnumDeclaration(node)) {
          const enumName = node.name.text;
          const { startLine, endLine } = this._getLineRange(sourceFile, node);
          entities.push({
            id: makeEntityId(filePath, 'enum', enumName),
            name: enumName,
            kind: 'enum',
            filePath,
            startLine,
            endLine,
            isExported: this._hasExportModifier(node),
          });
        }

        // ── 8. Call Expressions (and Dynamic Imports) ───────────────────────
        else if (ts.isCallExpression(node)) {
          // Dynamic Import: import('module')
          if (node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments.length > 0) {
            const arg = node.arguments[0];
            if (ts.isStringLiteral(arg)) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              imports.push({
                moduleSpecifier: arg.text,
                specifiers: [{ importedName: '*', localName: '*', isNamespace: true }],
                line: line + 1,
              });
            }
          } else {
            let calleeName = '';
            if (ts.isIdentifier(node.expression)) {
              calleeName = node.expression.text;
            } else if (ts.isPropertyAccessExpression(node.expression)) {
              calleeName = node.expression.name.text;
            }

            if (calleeName) {
              const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
              calls.push({
                calleeName,
                callerEntityId: scopeStack[scopeStack.length - 1],
                line: line + 1,
              });
            }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);

      return ok({
        filePath,
        fileEntity,
        entities,
        imports,
        calls,
        heritage,
      });
    } catch (parseError) {
      return err(CodeScopeError.from(parseError, 'PARSE_ERROR'));
    }
  }

  /**
   * Indexes a collection of files in sequence or parallel chunks.
   */
  public static async indexFiles(
    filePaths: string[],
    onProgress?: (indexedCount: number, currentFilePath: string) => void,
  ): Promise<AnalysisResult<FileIndexResult[]>> {
    const results: FileIndexResult[] = [];
    let count = 0;

    for (const filePath of filePaths) {
      const res = await this.indexFile(filePath);
      if (res.ok) {
        results.push(res.data);
      }
      count++;
      if (onProgress) {
        onProgress(count, filePath);
      }
    }

    return ok(results);
  }

  private static _hasExportModifier(node: ts.Node): boolean {
    if (!ts.canHaveModifiers(node)) {
      return false;
    }
    const modifiers = ts.getModifiers(node);
    if (!modifiers) {
      return false;
    }
    return modifiers.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
  }

  private static _getLineRange(
    sourceFile: ts.SourceFile,
    node: ts.Node,
  ): { startLine: number; endLine: number } {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd()).line + 1;
    return { startLine: start, endLine: end };
  }

  private static _getScriptKind(filePath: string): ts.ScriptKind {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
      case '.ts':
        return ts.ScriptKind.TS;
      case '.tsx':
        return ts.ScriptKind.TSX;
      case '.jsx':
        return ts.ScriptKind.JSX;
      case '.js':
      case '.mjs':
      case '.cjs':
      default:
        return ts.ScriptKind.JS;
    }
  }
}
