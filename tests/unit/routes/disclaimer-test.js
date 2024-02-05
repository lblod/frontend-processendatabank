import { module, test } from 'qunit';
import { setupTest } from 'frontend-processendatabank/tests/helpers';

module('Unit | Route | disclaimer', function (hooks) {
  setupTest(hooks);

  test('it exists', function (assert) {
    let route = this.owner.lookup('route:disclaimer');
    assert.ok(route);
  });
});
