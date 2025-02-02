import Service, { service } from '@ember/service';
import { tracked } from '@glimmer/tracking';

const EDITOR_ROLES = ['LoketLB-OpenProcesHuisGebruiker'];
const ADMIN_ROLE = 'LoketLB-admin';

export default class CurrentSessionService extends Service {
  @service session;
  @service store;
  @service impersonation;

  @tracked account;
  @tracked user;
  @tracked title;
  @tracked group;
  @tracked roles;

  async load() {
    if (this.session.isAuthenticated) {
      await this.impersonation.load();

      let sessionData = this.session.data.authenticated.relationships;
      this.roles = [
        ...new Set(this.session.data.authenticated.data?.attributes?.roles),
      ];

      let accountId = sessionData.account.data.id;
      this.account = await this.store.findRecord('account', accountId, {
        include: 'user',
      });
      this.user = this.account.user;

      let groupId = sessionData?.group?.data?.id;
      this.group = await this.store.findRecord('group', groupId);

      this.title = `${this.user.firstName} ${this.user.familyName} - ${this.group.name}`;
    }
  }

  get hasEditorRole() {
    return this.roles.some((role) => EDITOR_ROLES.includes(role));
  }

  get canEdit() {
    return this.session.isAuthenticated && this.hasEditorRole;
  }

  get canOnlyRead() {
    return !this.canEdit;
  }

  get canOnlyReadWhileAuthenticated() {
    return !this.isAdmin && this.session.isAuthenticated && !this.hasEditorRole;
  }

  get isAdmin() {
    let roles = this.roles;
    if (this.impersonation.isImpersonating)
      roles = this.impersonation.originalRoles || [];
    return roles?.includes(ADMIN_ROLE);
  }
}
