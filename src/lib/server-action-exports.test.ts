import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import ts from "typescript";
import { describe, expect, test } from "vitest";

const sourceRoot = join(process.cwd(), "src");

function listTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return listTypeScriptFiles(path);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith(".d.ts")
      ? [path]
      : [];
  });
}

function hasModifier(node: ts.Node, kind: ts.SyntaxKind) {
  return ts.canHaveModifiers(node)
    ? ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true
    : false;
}

function isFileLevelServerAction(sourceFile: ts.SourceFile) {
  const firstStatement = sourceFile.statements[0];
  return (
    firstStatement !== undefined &&
    ts.isExpressionStatement(firstStatement) &&
    ts.isStringLiteral(firstStatement.expression) &&
    firstStatement.expression.text === "use server"
  );
}

function isAsyncFunctionExport(statement: ts.Statement) {
  if (ts.isExportDeclaration(statement) || ts.isExportAssignment(statement)) {
    return false;
  }
  if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return true;

  if (ts.isFunctionDeclaration(statement)) {
    return hasModifier(statement, ts.SyntaxKind.AsyncKeyword);
  }

  if (ts.isVariableStatement(statement)) {
    return statement.declarationList.declarations.every((declaration) => {
      const initializer = declaration.initializer;
      return (
        initializer !== undefined &&
        (ts.isArrowFunction(initializer) ||
          ts.isFunctionExpression(initializer)) &&
        hasModifier(initializer, ts.SyntaxKind.AsyncKeyword)
      );
    });
  }

  return false;
}

describe("file-level use server exports", () => {
  test("exports only async functions", () => {
    const violations: string[] = [];

    for (const path of listTypeScriptFiles(sourceRoot)) {
      const sourceFile = ts.createSourceFile(
        path,
        readFileSync(path, "utf8"),
        ts.ScriptTarget.Latest,
        true,
        path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      if (!isFileLevelServerAction(sourceFile)) continue;

      for (const statement of sourceFile.statements) {
        if (isAsyncFunctionExport(statement)) continue;

        const { line } = sourceFile.getLineAndCharacterOfPosition(
          statement.getStart(sourceFile),
        );
        violations.push(
          `${relative(process.cwd(), path)}:${line + 1} exports ${ts.SyntaxKind[statement.kind]}`,
        );
      }
    }

    expect(violations).toEqual([]);
  });
});
