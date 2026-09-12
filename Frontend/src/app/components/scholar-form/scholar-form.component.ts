import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Scholar } from '../../interfaces/scholar';
import { School } from '../../interfaces/school';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';

// Handles both "create a scholar" (no :id in the route) and "edit a scholar"
// (:id present) — the two forms were previously two near-identical
// components; keeping them as one removes the duplication and gives both
// flows the same School dropdown and error handling.
@Component({
  selector: 'app-scholar-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './scholar-form.component.html',
  styleUrl: './scholar-form.component.css',
})
export class ScholarFormComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly scholarsService = inject(ScholarsService);
  private readonly schoolsService = inject(SchoolsService);

  scholarForm!: FormGroup;
  schools: School[] = [];
  isEditMode = false;
  scholarId: string | null = null;
  isSubmitting = false;

  ngOnInit(): void {
    this.initForm();

    this.schoolsService.getSchools().subscribe((schools) => {
      this.schools = schools;
    });

    this.scholarId = this.route.snapshot.paramMap.get('id');
    this.isEditMode = !!this.scholarId;

    if (this.isEditMode && this.scholarId) {
      this.scholarsService.getScholarById(this.scholarId).subscribe({
        next: (scholar) => this.populateForm(scholar),
        error: (err) => {
          console.error('Failed to load scholar:', err.message);
          alert('Failed to load scholar. Check console for details.');
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
      pickUpSchedule: formValue.pickUpSchedule,
    };

    this.isSubmitting = true;
    const save$ = this.isEditMode
      ? this.scholarsService.updateScholar(scholar)
      : this.scholarsService.createScholar(scholar);

    save$.subscribe({
      next: (savedScholar) => {
        this.isSubmitting = false;
        alert(
          this.isEditMode
            ? 'Scholar updated successfully!'
            : 'Scholar created successfully!',
        );
        this.router.navigate(['/scholars', savedScholar.id]);
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error(
          `Error ${this.isEditMode ? 'updating' : 'creating'} scholar:`,
          err.message,
        );
        alert(
          `Failed to ${this.isEditMode ? 'update' : 'create'} scholar. ${err.message}`,
        );
      },
    });
  }

  get pickUpScheduleGroup(): FormGroup {
    return this.scholarForm.get('pickUpSchedule') as FormGroup;
  }
}
