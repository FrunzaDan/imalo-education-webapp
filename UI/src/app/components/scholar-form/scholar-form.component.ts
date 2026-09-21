import { TitleCasePipe } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormField, FormRoot, form } from '@angular/forms/signals';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { WeekDays } from '../../constants/week-days';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { NotificationService } from '../../services/notification.service';
import {
  ScholarFormModel,
  emptyScholarForm,
  scholarFormSchema,
  toFormModel,
  toScholar,
} from './scholar-form';

// Handles both "create a scholar" (no :id in the route) and "edit a scholar"
// (:id present) — the two forms were previously two near-identical
// components; keeping them as one removes the duplication and gives both
// flows the same School dropdown and error handling.
@Component({
  selector: 'app-scholar-form',
  imports: [FormField, FormRoot, RouterModule, TitleCasePipe],
  templateUrl: './scholar-form.component.html',
  styleUrl: './scholar-form.component.css',
})
export class ScholarFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly notificationService = inject(NotificationService);

  readonly scholarId = this.route.snapshot.paramMap.get('id');
  readonly isEditMode = this.scholarId !== null;

  readonly schools = signal<School[]>([]);
  readonly weekDays = Object.values(WeekDays);

  // The form model is a plain signal; the form is a view over it. Loading an
  // existing scholar is just model.set(...) — no patchValue copy step.
  readonly model = signal<ScholarFormModel>(emptyScholarForm());
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
      phonePlaceholder: 'Phone, e.g. 0722 111 222',
    },
    {
      key: 'father',
      label: 'Father',
      firstName: this.scholarForm.fatherFirstName,
      lastName: this.scholarForm.fatherLastName,
      phoneNumber: this.scholarForm.fatherPhoneNumber,
      phonePlaceholder: 'Phone, e.g. 0733 444 555',
    },
  ] as const;

  ngOnInit(): void {
    this.schoolsService.getSchools().subscribe((schools) => {
      this.schools.set(schools);
    });

    if (this.scholarId) {
      this.scholarsService.getScholarById(this.scholarId).subscribe({
        next: (scholar) => this.model.set(toFormModel(scholar)),
        error: (err) => {
          console.error('Failed to load scholar:', err.message);
          this.notificationService.show(
            'Failed to load scholar. Check console for details.',
            'error',
          );
        },
      });
    }
  }

  // Runs only when the form is valid (FormRoot -> submit()); the form's own
  // submitting() state replaces the old hand-rolled isSubmitting signal.
  private async save(): Promise<void> {
    this.invalidSummary.set(null);
    const scholar = toScholar(this.model(), this.scholarId);
    const verb = this.isEditMode ? 'update' : 'create';

    try {
      const savedScholar = await firstValueFrom(
        this.isEditMode
          ? this.scholarsService.updateScholar(scholar)
          : this.scholarsService.createScholar(scholar),
      );
      this.notificationService.show(
        this.isEditMode
          ? 'Scholar updated successfully!'
          : 'Scholar created successfully!',
      );
      await this.router.navigate(['/scholars', savedScholar.id]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `Error ${this.isEditMode ? 'updating' : 'creating'} scholar:`,
        message,
      );
      this.notificationService.show(`Failed to ${verb} scholar. ${message}`, 'error');
    }
  }
}
