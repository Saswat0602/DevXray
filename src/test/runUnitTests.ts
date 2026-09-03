/* eslint-disable no-console */
// src/test/runUnitTests.ts
// ─────────────────────────────────────────────────────────────────────────────
// Standalone unit test suite for DevXray core analyzers.
// Tests ProjectScanner, FileIndexer, and DependencyGraphBuilder without VS Code.
// ─────────────────────────────────────────────────────────────────────────────

import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ProjectScanner } from '../analyzer/codebase/projectScanner';
import { FileIndexer } from '../analyzer/codebase/fileIndexer';
import { DependencyGraphBuilder } from '../analyzer/codebase/dependencyGraph';

async function runTests(): Promise<void> {
  console.log('🧪 Starting DevXray Phase 2 Unit Tests...\n');

  const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'devxray-test-'));

  try {
    // ── Setup fixture files ──
    const fileA = path.join(tmpDir, 'service.ts');
    const fileB = path.join(tmpDir, 'controller.ts');
    const ignoredDir = path.join(tmpDir, 'node_modules');
    await fs.promises.mkdir(ignoredDir);
    await fs.promises.writeFile(path.join(ignoredDir, 'vendor.js'), 'console.log("vendor");');

    await fs.promises.writeFile(
      fileA,
      `
export interface User {
  id: string;
  name: string;
}

export class UserService {
  public getUser(id: string): User {
    return { id, name: 'Alice' };
  }
}

export function helper(): void {
  // no-op
}
`,
    );

    await fs.promises.writeFile(
      fileB,
      `
import { UserService, helper } from './service';
import express from 'express';

export class UserController {
  private service = new UserService();

  public handleRequest(userId: string): void {
    helper();
    this.service.getUser(userId);
  }
}
`,
    );

    // ── 1. Test ProjectScanner ──
    console.log('▶ Test 1: ProjectScanner');
    const scanResult = await ProjectScanner.scan(tmpDir);
    assert.strictEqual(scanResult.ok, true, 'Scanner should succeed');
    if (!scanResult.ok) return;

    const files = scanResult.data;
    assert.strictEqual(files.length, 2, 'Should find exactly 2 files (ignoring node_modules)');
    assert.ok(files.some((f) => f.endsWith('service.ts')), 'Should include service.ts');
    assert.ok(files.some((f) => f.endsWith('controller.ts')), 'Should include controller.ts');
    console.log('  ✔ ProjectScanner correctly discovered files and ignored node_modules');

    // ── 2. Test FileIndexer ──
    console.log('▶ Test 2: FileIndexer');
    const indexResultA = await FileIndexer.indexFile(fileA);
    assert.strictEqual(indexResultA.ok, true, 'FileIndexer should succeed for service.ts');
    if (!indexResultA.ok) return;

    const entitiesA = indexResultA.data.entities;
    const namesA = entitiesA.map((e) => e.name);
    assert.ok(namesA.includes('User'), 'Should discover User interface');
    assert.ok(namesA.includes('UserService'), 'Should discover UserService class');
    assert.ok(namesA.includes('getUser'), 'Should discover getUser method');
    assert.ok(namesA.includes('helper'), 'Should discover helper function');

    const indexResultB = await FileIndexer.indexFile(fileB);
    assert.strictEqual(indexResultB.ok, true, 'FileIndexer should succeed for controller.ts');
    if (!indexResultB.ok) return;

    const importsB = indexResultB.data.imports;
    assert.strictEqual(importsB.length, 2, 'Should detect 2 import statements in controller.ts');
    const callsB = indexResultB.data.calls;
    assert.ok(callsB.some((c) => c.calleeName === 'helper'), 'Should capture call to helper()');
    console.log('  ✔ FileIndexer extracted entities, imports, and calls accurately');

    // ── 3. Test DependencyGraphBuilder ──
    console.log('▶ Test 3: DependencyGraphBuilder');
    const graphResult = DependencyGraphBuilder.build([indexResultA.data, indexResultB.data]);
    assert.strictEqual(graphResult.ok, true, 'Graph builder should succeed');
    if (!graphResult.ok) return;

    const graph = graphResult.data;
    assert.strictEqual(graph.fileCount, 2, 'Graph should have 2 files');
    assert.ok(graph.entities.size >= 6, 'Graph should have all entities + packages');

    // Verify import edges
    const importEdges = graph.edges.filter((e) => e.kind === 'import');
    assert.ok(importEdges.length >= 2, 'Should create import edges between files and packages');

    // Verify external package node
    assert.ok(graph.entities.has('pkg::express'), 'Should register external npm package express');

    // Verify call edge between controller and helper
    const callEdges = graph.edges.filter((e) => e.kind === 'call');
    assert.ok(
      callEdges.some((e) => e.to.includes('helper')),
      'Should create call edge pointing to helper entity',
    );

    console.log('  ✔ DependencyGraphBuilder resolved cross-file imports, external packages, and call edges');

    console.log('\n🎉 ALL UNIT TESTS PASSED SUCCESSFULLY!\n');
  } finally {
    // Cleanup temporary directory
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  }
}

void runTests();
