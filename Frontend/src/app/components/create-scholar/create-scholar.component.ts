import { Component, OnInit } from '@angular/core';
import {
  FormBuilder,
  FormGroup,
  Validators,
  ReactiveFormsModule,
} from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Scholar } from '../../interfaces/scholar';

@Component({
  selector: 'app-create-scholar',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './create-scholar.component.html',
  styleUrls: ['./create-scholar.component.css'],
})
export class CreateScholarComponent implements OnInit {
  scholarForm!: FormGroup;

  constructor(private fb: FormBuilder) {}

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
      birthDate: [[Validators.required, this.dateValidator]],
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
        id: 'temp-id-' + Date.now(), // Placeholder ID
        firstName: this.scholarForm.value.firstName,
        lastName: this.scholarForm.value.lastName,
        pickUpSchedule: null,
        schoolId: this.scholarForm.value.schoolId,
        grade: this.scholarForm.value.grade,
        birthDate: new Date(this.scholarForm.value.birthDate),
      };

      console.log('Form submitted successfully:', newScholar);
      this.scholarForm.reset();
    } else {
      this.scholarForm.markAllAsTouched();
      console.log('Form is invalid. Please correct the errors.');
    }
  }
}
