import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {bodyToScene, siteFrame} from '../components/workbench/scene/surface';
import {insideSouthPoleDetail, southPoleTerrainMatrix} from '../components/workbench/scene/south-pole-detail';

test('south-pole close-up covers the landing sites and not the equator', () => {
  assert.equal(insideSouthPoleDetail(-89.53432, 209.94767), true);
  assert.equal(insideSouthPoleDetail(-89.495, 222.5), true);
  assert.equal(insideSouthPoleDetail(-89.77, 204), true);
  assert.equal(insideSouthPoleDetail(-90, 0), true);
  assert.equal(insideSouthPoleDetail(0, 0), false);
  assert.equal(insideSouthPoleDetail(-80.13, 1.44), false);
});

test('terrain frame is identity at the south pole and places the pole on the sphere elsewhere', () => {
  const pole = siteFrame(-90, 0, 0);
  const identity = southPoleTerrainMatrix(pole);
  const origin = new T.Vector3();
  const east = new T.Vector3(1, 0, 0);
  assert.ok(origin.applyMatrix4(identity).length() < 1e-6);
  east.set(1, 0, 0);
  const moved = east.applyMatrix4(identity);
  assert.ok(Math.abs(moved.x - 1) < 1e-6 && Math.abs(moved.y) < 1e-6 && Math.abs(moved.z) < 1e-6);

  const ridge = siteFrame(-89.53432, 209.94767, 1500);
  const matrix = southPoleTerrainMatrix(ridge);
  const placed = new T.Vector3(0, 0, 0).applyMatrix4(matrix);
  const expected = bodyToScene(pole.up, 0, ridge);
  assert.ok(placed.distanceTo(expected) < 1e-6);
});
