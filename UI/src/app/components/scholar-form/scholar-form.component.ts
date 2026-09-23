import { TitleCasePipe } from '@angular/common';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { WEEK_DAYS } from '../../constants/week-days';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { extractErrorMessage } from '../../utils/extract-error-message';
import {
  ScholarFormModel,
  emptyScholarForm,
  isScholarFormDirty,
  scholarFormSchema,
  toFormModel,
  toScholar,
} from './scholar-form';

// Handles both "create a scholar" (no :scholarId in the route) and "edit a scholar"
// (:scholarId present) — the two forms were previously two near-identical
// components; keeping them as one removes the duplication and gives both
// flows the same School dropdown and error handling.
@Component({
  selector: 'app-scholar-form',
  imports: [FormField, FormRoot, RouterModule, TitleCasePipe],
  templateUrl: './scholar-form.component.html',
  styleUrl: './scholar-form.component.css',
  // Refresh / closing the tab isn't a router navigation, so guard it here too.
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ScholarFormComponent {
  private readonly router = inject(Router);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);

  // Bound from the `:scholarId` route param by withComponentInputBinding() in
  // app.config.ts; absent on the create route.
  readonly scholarId = input<string>();
  readonly isEditMode = computed(() => !!this.scholarId());

  // SchoolsService swallows errors into [], so this never errors.
  readonly schools = toSignal(this.schoolsService.getSchools(), {
    initialValue: [],
  });
  readonly weekDays = WEEK_DAYS;

  // Only loads in edit mode (params() is undefined on the create route, which
  // leaves the resource idle).
  private readonly scholarResource = rxResource({
    params: () => this.scholarId(),
    stream: ({ params: scholarId }) =>
      this.scholarsService.getScholarById(scholarId),
  });

  // Load failures are shown inline, in place of the form (an edit form with
  // nothing loaded into it would only invite a broken save).
  readonly loadError = computed(() => {
    const error = this.scholarResource.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load scholar',
        )
      : null;
  });

  // The form model is a signal that re-derives from the loaded scholar and
  // stays writable for the user's edits — no patchValue copy step.
  private readonly baseline = computed(() =>
    this.scholarResource.hasValue()
      ? toFormModel(this.scholarResource.value())
      : emptyScholarForm(),
  );
  readonly model = linkedSignal<ScholarFormModel>(() => this.baseline());

  private readonly saved = signal(false);

  // Read by unsavedChangesGuard: edits that differ from the loaded (or blank)
  // scholar and haven't been saved. Putting a value back clears it.
  readonly hasUnsavedChanges = computed(
    () => !this.saved() && isScholarFormDirty(this.model(), this.baseline()),
  );

  readonly saveError = signal<string | null>(null);
  readonly invalidSummary = signal<string | null>(null);

  readonly scholarForm = form(this.model, scholarFormSchema, {
    submission: {
      action: () => this.save(),
      onInvalid: (field) => {
        const errors = field().errorSummary();
        this.invalidSummary.set(
          `The form has ${errors.length} ${errors.length === 1 ? 'error' : 'errors'}. Please correct the highlighted fields.`,
        );
        // Move focus to the first problem so keyboard/screen-reader users land on it.
        errors[0]?.fieldTree().focusBoundControl();
      },
    },
  });

  // Mother and father are the same three fields; this lets the template loop
  // over them instead of repeating the markup (declared after scholarForm,
  // which it reads).
  protected readonly parents = [
    {
      key: 'mother',
      label: 'Mother',
      firstName: this.scholarForm.motherFirstName,
      lastName: this.scholarForm.motherLastName,
      phoneNumber: this.scholarForm.motherPhoneNumber,
      phonePlaceholder: 'Phone, e.g. 0722111222',
    },
    {
      key: 'father',
      label: 'Father',
      firstName: this.scholarForm.fatherFirstName,
      lastName: this.scholarForm.fatherLastName,
      phoneNumber: this.scholarForm.fatherPhoneNumber,
      phonePlaceholder: 'Phone, e.g. 0733444555',
    },
  ] as const;

  // Runs only when the form is valid (FormRoot -> submit()); the form's own
  // submitting() state replaces the old hand-rolled isSubmitting signal.
  private async save(): Promise<void> {
    this.invalidSummary.set(null);
    this.saveError.set(null);
    const scholar = toScholar(this.model(), this.scholarId() ?? null);
    const isEditMode = this.isEditMode();

    try {
      const savedScholar = await firstValueFrom(
        isEditMode
          ? this.scholarsService.updateScholar(scholar)
          : this.scholarsService.createScholar(scholar),
      );
      // Saved — leaving now must not trigger the unsaved-changes prompt.
      this.saved.set(true);
      await this.router.navigate(['/scholars', savedScholar.scholarId]);
    } catch (error) {
      this.saveError.set(
        extractErrorMessage(
          error as HttpErrorResponse,
          isEditMode ? 'Failed to update scholar' : 'Failed to create scholar',
        ),
      );
    }
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.hasUnsavedChanges()) event.preventDefault();
  }
}
