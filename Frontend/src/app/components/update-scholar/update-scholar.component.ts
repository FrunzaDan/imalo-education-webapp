import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { Scholar } from '../../interfaces/scholar';
import { ScholarsService } from '../../services/scholars.service';

@Component({
  selector: 'app-update-scholar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  templateUrl: './update-scholar.component.html',
  styleUrls: ['./update-scholar.component.css'],
})
export class UpdateScholarComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private scholarsService = inject(ScholarsService);
  private router = inject(Router);

  scholarForm!: FormGroup;
  scholarId!: string;

  constructor(private fb: FormBuilder) {}

  ngOnInit(): void {
    this.initForm();

    // Get the ID from the route
    this.scholarId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.scholarId) {
      console.error('Scholar ID missing in route!');
      return;
    }

    // Fetch scholar from API
    this.scholarsService.getScholarById(this.scholarId).subscribe({
      next: (scholar) => {
        this.populateForm(scholar);
      },
      error: (err) => {
        console.error('Failed to load scholar:', err.message);
      },
    });
  }

  private initForm(): void {
    this.scholarForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      schoolId: ['', Validators.required],
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

    const updatedScholar: Scholar = {
      id: this.scholarId, // keep the original ID
      firstName: formValue.firstName,
      lastName: formValue.lastName,
      schoolId: formValue.schoolId,
      grade: formValue.grade,
      dateOfBirth: new Date(formValue.dateOfBirth),
      pickUpSchedule: formValue.pickUpSchedule,
    };

    this.scholarsService.updateScholar(updatedScholar).subscribe({
      next: (sch) => {
        console.log('Scholar updated:', sch);
        alert('Scholar updated successfully!');
        this.router.navigate(['/scholars', this.scholarId]);
      },
      error: (err) => {
        console.error('Error updating scholar:', err.message);
        alert('Failed to update scholar. Check console for details.');
      },
    });
  }

  get pickUpScheduleGroup(): FormGroup {
    return this.scholarForm.get('pickUpSchedule') as FormGroup;
  }
}
