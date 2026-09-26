import * as assert from 'assert';
import * as ts from 'typescript';
import { PerformanceAnalyzer } from '../../analyzer/performance/performanceAnalyzer';

suite('Performance Analyzer Test Suite', () => {

  test('Should detect await in loop', () => {
    const code = `
      async function test() {
        for (let i = 0; i < 10; i++) {
          await doSomething();
        }
      }
    `;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
    const issues = PerformanceAnalyzer.analyze(sourceFile);
    
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].ruleId, 'await-in-loop');
  });

  test('Should ignore await in loop if inside another function', () => {
    const code = `
      async function test() {
        for (let i = 0; i < 10; i++) {
          const fn = async () => {
             await doSomething();
          }
        }
      }
    `;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
    const issues = PerformanceAnalyzer.analyze(sourceFile);
    
    // No issue because the await belongs to the inner function, not the loop!
    assert.strictEqual(issues.length, 0);
  });

  test('Should detect synchronous call inside async function', () => {
    const code = `
      async function test() {
        fs.readFileSync('foo.txt');
      }
    `;
    const sourceFile = ts.createSourceFile('test.ts', code, ts.ScriptTarget.Latest, true);
    const issues = PerformanceAnalyzer.analyze(sourceFile);
    
    assert.strictEqual(issues.length, 1);
    assert.strictEqual(issues[0].ruleId, 'sync-in-async');
  });

});
