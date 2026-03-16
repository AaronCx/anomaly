import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import type {
  ParsedFile,
} from '@/lib/parser/types';

/**
 * Parse a JavaScript or TypeScript file using @babel/parser + @babel/traverse.
 * Extracts imports, exports, functions, and call relationships.
 */
export function parseJavaScript(content: string, filePath: string): ParsedFile {
  const imports: ParsedFile['imports'] = [];
  const exports: string[] = [];
  const functions: ParsedFile['functions'] = [];
  const calls: ParsedFile['calls'] = [];
  const loc = content.split('\n').length;

  let ast;
  try {
    ast = parse(content, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx', 'decorators-legacy'],
      errorRecovery: true,
    });
  } catch {
    return { filePath, imports, exports, functions, calls, loc };
  }

  const functionStack: string[] = [];

  // Handle CJS/ESM interop for @babel/traverse
  const traverseFn =
    typeof traverse === 'function'
      ? traverse
      : (traverse as unknown as { default: typeof traverse }).default;

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const visitor: any = {
    ImportDeclaration(path: any) {
      const source = path.node.source.value;
      const specifiers = path.node.specifiers.map((s: any) => {
        if (s.type === 'ImportDefaultSpecifier') return 'default';
        if (s.type === 'ImportNamespaceSpecifier') return '*';
        return s.local.name;
      });
      imports.push({ source, specifiers });
    },

    ExportNamedDeclaration(path: any) {
      const decl = path.node.declaration;
      if (decl) {
        if (
          decl.type === 'FunctionDeclaration' ||
          decl.type === 'ClassDeclaration'
        ) {
          if (decl.id) exports.push(decl.id.name);
        } else if (decl.type === 'VariableDeclaration') {
          for (const d of decl.declarations) {
            if (d.id.type === 'Identifier') exports.push(d.id.name);
          }
        }
      }
      if (path.node.specifiers) {
        for (const spec of path.node.specifiers) {
          if (spec.exported.type === 'Identifier') {
            exports.push(spec.exported.name);
          }
        }
      }
    },

    ExportDefaultDeclaration(path: any) {
      const decl = path.node.declaration;
      if (
        decl.type === 'FunctionDeclaration' ||
        decl.type === 'ClassDeclaration'
      ) {
        exports.push(decl.id?.name ?? 'default');
      } else if (decl.type === 'Identifier') {
        exports.push(decl.name);
      } else {
        exports.push('default');
      }
    },

    FunctionDeclaration: {
      enter(path: any) {
        const name = path.node.id?.name ?? '<anonymous>';
        const line = path.node.loc?.start.line ?? 0;
        const params = path.node.params.map((p: any) => {
          if (p.type === 'Identifier') return p.name;
          if (p.type === 'AssignmentPattern' && p.left.type === 'Identifier')
            return p.left.name;
          return '...';
        });
        const isExported =
          path.parent.type === 'ExportNamedDeclaration' ||
          path.parent.type === 'ExportDefaultDeclaration';

        functions.push({ name, line, params, body: '', isExported });
        functionStack.push(name);
      },
      exit() {
        functionStack.pop();
      },
    },

    VariableDeclarator: {
      enter(path: any) {
        const init = path.node.init;
        if (
          init &&
          (init.type === 'ArrowFunctionExpression' ||
            init.type === 'FunctionExpression')
        ) {
          if (path.node.id.type === 'Identifier') {
            const name = path.node.id.name;
            const line = path.node.loc?.start.line ?? 0;
            const params = init.params.map((p: any) => {
              if (p.type === 'Identifier') return p.name;
              if (
                p.type === 'AssignmentPattern' &&
                p.left.type === 'Identifier'
              )
                return p.left.name;
              return '...';
            });

            const parentDecl = path.parentPath?.parent;
            const isExported =
              parentDecl?.type === 'ExportNamedDeclaration';

            functions.push({ name, line, params, body: '', isExported });
            functionStack.push(name);
          }
        }
      },
      exit(path: any) {
        const init = path.node.init;
        if (
          init &&
          (init.type === 'ArrowFunctionExpression' ||
            init.type === 'FunctionExpression') &&
          path.node.id.type === 'Identifier'
        ) {
          functionStack.pop();
        }
      },
    },

    CallExpression(path: any) {
      const caller = functionStack[functionStack.length - 1] ?? '<module>';
      const line = path.node.loc?.start.line ?? 0;
      let callee = '';

      const calleeNode = path.node.callee;
      if (calleeNode.type === 'Identifier') {
        callee = calleeNode.name;
      } else if (
        calleeNode.type === 'MemberExpression' &&
        calleeNode.object.type === 'Identifier' &&
        calleeNode.property.type === 'Identifier'
      ) {
        callee = `${calleeNode.object.name}.${calleeNode.property.name}`;
      }

      if (callee) {
        calls.push({ caller, callee, line });
      }
    },
  };
  /* eslint-enable @typescript-eslint/no-explicit-any */

  traverseFn(ast, visitor);

  return { filePath, imports, exports, functions, calls, loc };
}
