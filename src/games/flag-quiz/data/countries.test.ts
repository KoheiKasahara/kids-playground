/// <reference types="node" />

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { countries, countriesForLevel } from './countries';

describe('countries', () => {
  it('全部で150か国ある', () => {
    expect(countries).toHaveLength(150);
  });

  it('国idに重複がない', () => {
    const ids = countries.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('各国のflagパスが flags/<id>.svg 形式である', () => {
    for (const country of countries) {
      expect(country.flag).toBe(`flags/${country.id}.svg`);
    }
  });

  it('150か国すべてのflagはpublic配下に実ファイルがある', () => {
    for (const country of countries) {
      expect(existsSync(resolve('public', country.flag))).toBe(true);
    }
  });
});

describe('countriesForLevel', () => {
  it('かんたんは20か国', () => {
    expect(countriesForLevel('easy')).toHaveLength(20);
  });

  it('ふつうは45か国', () => {
    expect(countriesForLevel('normal')).toHaveLength(45);
  });

  it('むずかしいは105か国', () => {
    expect(countriesForLevel('hard')).toHaveLength(105);
  });

  it('おには150か国（全部）', () => {
    expect(countriesForLevel('oni')).toHaveLength(150);
  });

  it('おにでリクエストされたカリブの国が出題される', () => {
    const oniIds = new Set(countriesForLevel('oni').map((c) => c.id));
    for (const id of ['ag', 'kn', 'vc', 'tt']) {
      expect(oniIds.has(id)).toBe(true);
    }
  });

  it('かんたん ⊂ ふつう ⊂ むずかしい ⊂ おに（包含関係が成り立つ）', () => {
    const easyIds = new Set(countriesForLevel('easy').map((c) => c.id));
    const normalIds = new Set(countriesForLevel('normal').map((c) => c.id));
    const hardIds = new Set(countriesForLevel('hard').map((c) => c.id));
    const oniIds = new Set(countriesForLevel('oni').map((c) => c.id));

    for (const id of easyIds) {
      expect(normalIds.has(id)).toBe(true);
    }
    for (const id of normalIds) {
      expect(hardIds.has(id)).toBe(true);
    }
    for (const id of hardIds) {
      expect(oniIds.has(id)).toBe(true);
    }
  });

  it('元の countries 配列を破壊的に変更しない', () => {
    const before = countries.length;
    countriesForLevel('easy');
    countriesForLevel('normal');
    countriesForLevel('hard');
    countriesForLevel('oni');
    expect(countries).toHaveLength(before);
  });
});
