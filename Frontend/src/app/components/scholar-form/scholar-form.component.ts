import { Component, OnInit, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { NotificationService } from '../../services/notification.service';

// Handles both "create a scholar" (no :id in the route) and "edit a scholar"
// (:id present) — the two forms were previously two near-identical
// components; keeping them as one removes the duplication and gives both
// flows the same School dropdown and error handling.
@Component({
  selector: 'app-scholar-form',
  standalone: true,
  imports: [ReactiveFormsModule, RouterModule],
  templateUrl: './scholar-form.component.html',
  styleUrl: './scholar-form.component.css',
})
export class ScholarFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);
  private readonly notificationService = inject(NotificationService);

  scholarForm!: FormGroup;
  schools = signal<School[]>([]);
  isEditMode = false;
  scholarId: string | null = null;
  isSubmitting = signal(false);

  // Matches the backend's ValidatePhoneNumber — loose on purpose (no
  // country-specific format assumed), just enough to catch obviously wrong
  // input (e.g. text typed into the field) before a round-trip to the API.
  private static readonly PHONE_PATTERN = /^\+?[0-9 ()-]{6,20}$/;

  ngOnInit(): void {
    this.initForm();

    this.schoolsService.getSchools().subscribe((schools) => {
      this.schools.set(schools);
    });

    this.scholarId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.scholarId;

    if (this.isEditMode && this.scholarId) {
      this.scholarsService.getScholarById(this.scholarId).subscribe({
        next: (scholar) => this.populateForm(scholar),
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

  private initForm(): void {
    this.scholarForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.maxLength(100)]],
      lastName: ['', [Validators.required, Validators.maxLength(100)]],
      schoolId: [null, Validators.required],
      grade: [
        null,
        [Validators.required, Validators.min(0), Validators.max(12)],
      ],
      dateOfBirth: ['', [Validators.required, this.dateValidator]],
      motherFirstName: ['', [Validators.maxLength(100)]],
      motherLastName: ['', [Validators.maxLength(100)]],
      motherPhoneNumber: ['', [Validators.pattern(ScholarFormComponent.PHONE_PATTERN)]],
      fatherFirstName: ['', [Validators.maxLength(100)]],
      fatherLastName: ['', [Validators.maxLength(100)]],
      fatherPhoneNumber: ['', [Validators.pattern(ScholarFormComponent.PHONE_PATTERN)]],
      pickUpSchedule: this.fb.group({
        monday: [''],
        tuesday: [''],
        wednesday: [''],
        thursday: [''],
        friday: [''],
      }),
    });
  }

  private populateForm(scholar: Scholar): void {
    this.scholarForm.patchValue({
      firstName: scholar.firstName,
      lastName: scholar.lastName,
      schoolId: scholar.schoolId,
      grade: scholar.grade,
      dateOfBirth: scholar.dateOfBirth
        ? new Date(scholar.dateOfBirth).toISOString().substring(0, 10)
        : '',
      motherFirstName: scholar.motherFirstName ?? '',
      motherLastName: scholar.motherLastName ?? '',
      motherPhoneNumber: scholar.motherPhoneNumber ?? '',
      fatherFirstName: scholar.fatherFirstName ?? '',
      fatherLastName: scholar.fatherLastName ?? '',
      fatherPhoneNumber: scholar.fatherPhoneNumber ?? '',
      pickUpSchedule: scholar.pickUpSchedule || {},
    });
  }

  dateValidator(control: { value: string | number | Date }) {
    if (!control.value) return null;
    const date = new Date(control.value);
    return isNaN(date.getTime()) || date > new Date()
      ? { invalidDate: true }
      : null;
  }

  onSubmit(): void {
    if (this.scholarForm.invalid) {
      this.scholarForm.markAllAsTouched();
      console.warn('Form is invalid. Please correct the errors.');
      return;
    }

    const formValue = this.scholarForm.value;
    const scholar: Scholar = {
      id: this.scholarId ?? '00000000-0000-0000-0000-000000000000',
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      schoolId: formValue.schoolId,
      grade: formValue.grade,
      dateOfBirth: new Date(formValue.dateOfBirth),
      motherFirstName: formValue.motherFirstName || null,
      motherLastName: formValue.motherLastName || null,
      motherPhoneNumber: formValue.motherPhoneNumber || null,
      fatherFirstName: formValue.fatherFirstName || null,
      fatherLastName: formValue.fatherLastName || null,
      fatherPhoneNumber: formValue.fatherPhoneNumber || null,
      pickUpSchedule: formValue.pickUpSchedule,
    };

    this.isSubmitting.set(true);
    const save$ = this.isEditMode
      ? this.scholarsService.updateScholar(scholar)
      : this.scholarsService.createScholar(scholar);

    save$.subscribe({
      next: (savedScholar) => {
        this.isSubmitting.set(false);
        this.notificationService.show(
          this.isEditMode
            ? 'Scholar updated successfully!'
            : 'Scholar created successfully!',
        );
        this.router.navigate(['/scholars', savedScholar.id]);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        console.error(
          `Error ${this.isEditMode ? 'updating' : 'creating'} scholar:`,
          err.message,
        );
        this.notificationService.show(
          `Failed to ${this.isEditMode ? 'update' : 'create'} scholar. ${err.message}`,
          'error',
        );
      },
    });
  }

  get pickUpScheduleGroup(): FormGroup {
    return this.scholarForm.get('pickUpSchedule') as FormGroup;
  }
}
