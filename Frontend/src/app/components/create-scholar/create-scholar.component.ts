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
      const newScholar: Scholar = {
        id: '00000000-0000-0000-0000-000000000000',
        firstName: this.scholarForm.value.firstName,
        lastName: this.scholarForm.value.lastName,
        pickUpSchedule: null,
        schoolId: this.scholarForm.value.schoolId,
        grade: this.scholarForm.value.grade,
        dateOfBirth: new Date(this.scholarForm.value.dateOfBirth),
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
      console.log('Form is invalid. Please correct the errors.');
    }
  }
}
