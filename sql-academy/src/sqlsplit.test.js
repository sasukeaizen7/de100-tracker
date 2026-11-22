import { describe, expect, it } from 'vitest';
import { splitSql } from './sqlsplit';

describe('splitSql', () => {
  it('splits on top-level semicolons and drops comment-only pieces', () => {
    expect(splitSql('select 1; select 2;\n-- done')).toEqual(['select 1', 'select 2']);
  });

  it('ignores semicolons inside strings, identifiers and comments', () => {
    expect(splitSql("select 'a;b', \"x;y\" from t; -- c;d\nselect 2 /* e;f */")).toEqual([
      "select 'a;b', \"x;y\" from t",
      '-- c;d\nselect 2 /* e;f */',
    ]);
  });

  it('keeps dollar-quoted function bodies whole', () => {
    const sql = 'create function f() returns int language plpgsql as $$ begin return 1; end; $$;\nselect f();';
    expect(splitSql(sql)).toEqual(['create function f() returns int language plpgsql as $$ begin return 1; end; $$', 'select f()']);
  });

  it('handles tagged dollar quotes, doubled quotes and E-strings', () => {
    expect(splitSql("select $q$a;b$q$; select 'it''s;'; select E'\\';'")).toEqual([
      'select $q$a;b$q$', "select 'it''s;'", "select E'\\';'",
    ]);
  });

  it('does not treat positional parameters as dollar quotes', () => {
    expect(splitSql('select $1; select 2')).toEqual(['select $1', 'select 2']);
  });
});
