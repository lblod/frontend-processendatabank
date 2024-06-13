import Controller from '@ember/controller';
import { tracked } from '@glimmer/tracking';
import { action } from '@ember/object';
import { task, dropTask } from 'ember-concurrency';
import { inject as service } from '@ember/service';
import generateBpmnFileDownloadUrl from 'frontend-openproceshuis/utils/bpmn-download-url';
import downloadFileByUrl from 'frontend-openproceshuis/utils/file-downloader';

export default class ProcessesProcessIndexController extends Controller {
  queryParams = ['page', 'size', 'sort'];

  @service store;
  @service router;
  @service currentSession;
  @service toaster;

  @tracked page = 0;
  size = 20;
  @tracked sort = 'name';
  @tracked downloadModalOpened = false;
  @tracked replaceModalOpened = false;
  @tracked edit = false;
  @tracked formIsValid = false;

  downloadTypes = [
    {
      extension: 'bpmn',
      mime: 'text/xml',
      label: 'origineel',
    },
    {
      extension: 'png',
      mime: 'image/png',
      label: 'afbeelding',
    },
    {
      extension: 'svg',
      mime: 'image/svg+xml',
      label: 'vectorafbeelding',
    },
    {
      extension: 'pdf',
      mime: 'application/pdf',
      label: 'PDF',
    },
  ];

  get process() {
    return this.model.loadProcessTaskInstance.isFinished
      ? this.model.loadProcessTaskInstance.value
      : this.model.loadedProcess;
  }

  get processIsLoading() {
    return this.model.loadProcessTaskInstance.isRunning;
  }

  get processHasErrored() {
    return this.model.loadProcessTaskInstance.isError;
  }

  get files() {
    return this.model.loadFilesTaskInstance.isFinished
      ? this.model.loadFilesTaskInstance.value
      : this.model.loadedFiles;
  }

  get filesBatchIsLoading() {
    return this.model.loadFilesTaskInstance.isRunning;
  }

  get filesBatchHasErrored() {
    return this.model.loadFilesTaskInstance.isError;
  }

  get bpmnFiles() {
    return this.files?.filter((file) => file.isBpmnFile);
  }

  get newestBpmnFile() {
    if (!this.bpmnFiles || this.bpmnFiles.length === 0) return null;
    const sortedBpmnFiles = this.bpmnFiles.sort(
      (fileA, fileB) => fileB.created - fileA.created
    );
    return sortedBpmnFiles[0];
  }

  get processSteps() {
    return this.model.loadProcessStepsTaskInstance.isFinished
      ? this.model.loadProcessStepsTaskInstance.value
      : this.model.loadedProcessSteps;
  }

  get processStepsBatchIsLoading() {
    return this.model.loadProcessStepsTaskInstance.isRunning;
  }

  get processStepsBatchHasNoResults() {
    return (
      this.model.loadProcessStepsTaskInstance.isFinished &&
      this.processSteps?.length === 0
    );
  }

  get processStepsBatchHasErrored() {
    return this.model.loadProcessStepsTaskInstance.isError;
  }

  get canEdit() {
    return (
      this.currentSession.canEdit &&
      this.currentSession.group &&
      this.process?.publisher &&
      this.process.publisher.id === this.currentSession.group.id
    );
  }

  @action
  resetFilters() {
    this.page = 0;
    this.sort = 'name';

    // Triggers a refresh of the model
    this.page = null;
  }

  @action
  openDownloadModal() {
    this.downloadModalOpened = true;
  }

  @action
  closeDownloadModal() {
    this.downloadModalOpened = false;
  }

  @action
  async downloadBpmnFile(downloadType) {
    if (!this.newestBpmnFile) return;

    const url = generateBpmnFileDownloadUrl(this.newestBpmnFile.id);
    const headers = {
      Accept: downloadType.mime,
    };
    const fileName = `${this.newestBpmnFile.name}.${downloadType.extension}`;
    await downloadFileByUrl(url, headers, fileName);
  }

  @action
  openReplaceModal() {
    this.replaceModalOpened = true;
  }

  @action
  closeReplaceModal() {
    this.replaceModalOpened = false;
  }

  @dropTask
  *updateProcess(newBpmnFileId) {
    const newBpmnFile = yield this.store.findRecord('file', newBpmnFileId);

    this.process.files.push(newBpmnFile);
    this.process.modified = newBpmnFile.created;

    yield this.process.save();
  }

  @task({ enqueue: true, maxConcurrency: 3 })
  *extractBpmnElements(newBpmnFileId) {
    yield fetch(`/bpmn?id=${newBpmnFileId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/vnd.api+json',
      },
    });
  }

  @action
  fileUploaded() {
    this.replaceModalOpened = false;
    this.router.refresh();
  }

  @action
  toggleEdit() {
    this.edit = !this.edit;
    this.validateForm();
  }

  @dropTask
  *updateModel(event) {
    event.preventDefault();

    if (!this.process) return;

    if (this.process.validate() && this.process.hasDirtyAttributes) {
      this.process.modified = new Date();

      try {
        yield this.process.save();
        this.edit = false;
        this.toaster.success('Proces succesvol bijgewerkt', 'Gelukt!', {
          timeOut: 5000,
        });
      } catch (error) {
        console.error(error);
        this.toaster.error('Proces kon niet worden bijgewerkt', 'Fout');
        this.resetModel();
      }
    } else {
      this.resetModel();
    }
  }

  @action
  resetModel() {
    this.process?.rollbackAttributes();
    this.replaceModalOpened = false;
    this.edit = false;
  }

  @action
  setProcessTitle(event) {
    if (!this.process) return;
    this.process.title = event.target.value;
    this.validateForm();
  }

  @action
  setProcessDescription(event) {
    if (!this.process) return;
    this.process.description = event.target.value;
    this.validateForm();
  }

  validateForm() {
    this.formIsValid =
      this.process?.validate() && this.process?.hasDirtyAttributes;
  }
}
