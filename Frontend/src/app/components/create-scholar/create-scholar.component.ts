import { CommonModule } from '@angular/common';
import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Scholar } from '../../interfaces/scholar';
import { ScholarsService } from '../../services/scholars.service';

@Component({
  selector: 'app-create-scholar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-scholar.component.html',
  styleUrls: ['./create-scholar.component.css'],
})
export class CreateScholarComponent implements OnInit {
  scholarForm!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private scholarsService: ScholarsService,
  ) {}

  ngOnInit(): void {
    this.initForm();
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

  dateValidator(control: { value: string | number | Date }) {
    if (!control.value) {
      return null;
    }
    const date = new Date(control.value);
    if (isNaN(date.getTime()) || date > new Date()) {
      return { invalidDate: true };
    }
    return null;
  }

  onSubmit(): void {
    if (this.scholarForm.valid) {
      const formValue = this.scholarForm.value;

      const newScholar: Scholar = {
        id: '00000000-0000-0000-0000-000000000000',
        firstName: formValue.firstName,
        lastName: formValue.lastName,
        pickUpSchedule: formValue.pickUpSchedule,
        schoolId: formValue.schoolId,
        grade: formValue.grade,
        dateOfBirth: new Date(formValue.dateOfBirth),
      };

      this.scholarsService.createScholar(newScholar).subscribe({
        next: (createdScholar) => {
          console.log('Scholar created:', createdScholar);
          this.scholarForm.reset();
        },
        error: (err) => {
          console.error('Error creating scholar:', err.message);
        },
      });
    } else {
      this.scholarForm.markAllAsTouched();
      console.warn('Form is invalid. Please correct the errors.');
    }
  }

  get pickUpScheduleGroup(): FormGroup {
    return this.scholarForm.get('pickUpSchedule') as FormGroup;
  }
}
