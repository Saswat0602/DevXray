import * as assert from 'assert';
import { ContextBuilder } from '../../analyzer/ai/contextBuilder';
import { GraphStore } from '../../core/graphStore';
import { CodebaseGraph } from '../../core/types/Dependency';

suite('Context Builder Test Suite', () => {

  test('Should correctly serialize an empty graph', () => {
    const store = new GraphStore();
    const mockGraph: CodebaseGraph = {
      entities: new Map(),
      edges: [],
      fileCount: 0,
      scannedAt: new Date()
    };
    store.setGraph(mockGraph);

    const markdown = ContextBuilder.buildContext(store);
    assert.ok(markdown.includes('# Codebase Context'));
    assert.ok(!markdown.includes('## Files'));
  });

  test('Should correctly format entities and edges', () => {
    const store = new GraphStore();
    
    const mockGraph: CodebaseGraph = {
      entities: new Map([
        ['file::foo.ts', { id: 'file::foo.ts', name: 'foo.ts', kind: 'file', filePath: 'foo.ts', startLine: 1, endLine: 10, isExported: false }],
        ['function::foo.ts::myFunc', { id: 'function::foo.ts::myFunc', name: 'myFunc', kind: 'function', filePath: 'foo.ts', startLine: 2, endLine: 5, isExported: true }]
      ]),
      edges: [
        { from: 'file::foo.ts', to: 'function::foo.ts::myFunc', kind: 'reference', filePath: 'foo.ts', line: 1 }
      ],
      fileCount: 1,
      scannedAt: new Date()
    };
    
    store.setGraph(mockGraph);
    const markdown = ContextBuilder.buildContext(store);
    
    assert.ok(markdown.includes('foo.ts (file)'));
    assert.ok(markdown.includes('myFunc (function)'));
    assert.ok(markdown.includes('file::foo.ts --[reference]--> function::foo.ts::myFunc'));
  });

});
