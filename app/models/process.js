import Model, { hasMany } from '@ember-data/model';

export default class ProcessModel extends Model {
  @hasMany('bpmn-file', { inverse: null, async: false }) derivations;

  get derivation() {
    return this.derivations[0];
  }
}
