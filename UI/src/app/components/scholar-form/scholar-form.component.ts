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
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { WEEK_DAYS } from '../../constants/week-days';
import { ScholarService } from '../../services/scholar.service';
import { SchoolService } from '../../services/school.service';
import { extractErrorMessage } from '../../utils/extract-error-message';
import {
  ScholarFormModel,
  emptyScholarForm,
  isScholarFormDirty,
  scholarFormSchema,
  toFormModel,
  toScholar,
} from './scholar-form';

@Component({
  selector: 'app-scholar-form',
  imports: [FormField, FormRoot, TitleCasePipe],
  templateUrl: './scholar-form.component.html',
  styleUrl: './scholar-form.component.css',
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ScholarFormComponent {
  private readonly router = inject(Router);
  private readonly scholarService = inject(ScholarService);
  private readonly schoolService = inject(SchoolService);

  readonly scholarId = input<string>();
  readonly isEditMode = computed(() => !!this.scholarId());

  readonly schools = toSignal(this.schoolService.getSchools(), {
    initialValue: [],
  });
  readonly weekDays = WEEK_DAYS;

  private readonly scholarResource = rxResource({
    params: () => this.scholarId(),
    stream: ({ params: scholarId }) =>
      this.scholarService.getScholar(scholarId),
  });

  readonly loadError = computed(() => {
    const error = this.scholarResource.error();
    return error
      ? extractErrorMessage(
          error as HttpErrorResponse,
          'Failed to load scholar',
        )
      : null;
  });

  private readonly baseline = computed(() =>
    this.scholarResource.hasValue()
      ? toFormModel(this.scholarResource.value())
      : emptyScholarForm(),
  );
  readonly model = linkedSignal<ScholarFormModel>(() => this.baseline());

  private readonly saved = signal(false);

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
        errors[0]?.fieldTree().focusBoundControl();
      },
    },
  });

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

  private async save(): Promise<void> {
    this.invalidSummary.set(null);
    this.saveError.set(null);
    const scholar = toScholar(this.model(), this.scholarId() ?? null);
    const isEditMode = this.isEditMode();

    try {
      const savedScholar = await firstValueFrom(
        isEditMode
          ? this.scholarService.updateScholar(scholar)
          : this.scholarService.createScholar(scholar),
      );
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
