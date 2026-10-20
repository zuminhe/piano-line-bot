import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('admin provisioning route defaults to disabled and uploads base64 PNG only after auth',()=>{
 const api=readFileSync(new URL('../api/admin.js',import.meta.url),'utf8');
 assert.match(api,/payload\.action === 'provision_test_menu'/);
 assert.match(api,/RICH_MENU_PROVISION_MODE !== 'enabled'/);
 assert.match(api,/prepareUnlinkedTestMenu\(/);
 assert.match(api,/allowCreate:true/);
 assert.match(api,/Buffer\.from\(base64,'base64'\)/);
 const authIndex=api.indexOf("if (!authorized(req))");
 const provisionIndex=api.indexOf("payload.action === 'provision_test_menu'");
 assert.ok(authIndex>=0&&provisionIndex>authIndex);
});
test('admin UI demands a user-supplied approved PNG and does not offer menu linking',()=>{
 const ui=readFileSync(new URL('../admin.html',import.meta.url),'utf8');
 assert.match(ui,/id="testMenuImage" type="file" accept="image\/png"/);
 assert.match(ui,/id="provisionTestMenu"/);
 assert.match(ui,/action:'provision_test_menu'/);
 assert.match(ui,/imageBase64:base64/);
 assert.match(ui,/尚未綁定任何學員/);
 assert.doesNotMatch(ui,/action:'link_test_menu'/);
 assert.doesNotMatch(ui,/action:'make_default_menu'/);
});
