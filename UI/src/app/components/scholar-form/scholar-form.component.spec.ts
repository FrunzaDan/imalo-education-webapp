import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ScholarFormComponent } from './scholar-form.component';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { NotificationService } from '../../services/notification.service';
import { emptyScholarForm, toFormModel, toScholar } from './scholar-form';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';

// TestBed spec for the Signal Forms version of ScholarFormComponent. Follows the
// pattern of attendance-per-scholar.component.spec.ts: standalone component,
// zoneless, plain-object service fakes with synchronous observables. Business
// rules go through the model signal; one test drives real DOM events to prove
// the [formField] bindings (text / select / number / date / time) still wire up.

const SCHOOLS: School[] = [
  { id: 1, name: 'Test School', color: '#336699', lunchPrice: 15, transportPrice: 10 },
  { id: 2, name: 'Other School', color: '#993366', lunchPrice: 12, transportPrice: 8 },
];

const EXISTING: Scholar = {
  id: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  schoolId: 2,
  grade: 0,
  dateOfBirth: new Date('2016-01-01'),
  motherFirstName: 'Maria',
  motherLastName: null,
  motherPhoneNumber: '0722 111 222',
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
  pickUpSchedule: { monday: '12:00', tuesday: null },
};

interface SetupOptions {
  routeId?: string | null;
  saveResult?: 'success' | 'error';
  loadResult?: 'success' | 'error';
}

async function setup(options: SetupOptions = {}) {
  const saved: Scholar = { ...EXISTING, id: 'saved-id' };
  const createScholar = vi.fn(() =>
    options.saveResult === 'error'
      ? throwError(() => new Error('createScholar failed: Invalid phone number.'))
      : of(saved),
  );
  const updateScholar = vi.fn(() => of(saved));
  const getScholarById = vi.fn(() =>
    options.loadResult === 'error'
      ? throwError(() => new Error('getScholarById id=scholar-1 failed: Scholar not found.'))
      : of(EXISTING),
  );
  const notificationService = { show: vi.fn() };
  const navigate = vi.fn().mockResolvedValue(true);

  TestBed.configureTestingModule({
    imports: [ScholarFormComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: Router, useValue: { navigate } },
      { provide: ScholarsService, useValue: { createScholar, updateScholar, getScholarById } },
      { provide: SchoolsService, useValue: { getSchools: () => of(SCHOOLS) } },
      { provide: NotificationService, useValue: notificationService },
    ],
  });

  const fixture: ComponentFixture<ScholarFormComponent> = TestBed.createComponent(ScholarFormComponent);
  // The route's :id reaches the component as an input (withComponentInputBinding()).
  if (options.routeId) fixture.componentRef.setInput('id', options.routeId);
  fixture.detectChanges();
  await fixture.whenStable(); // let the scholar rxResource load in edit mode
  return { fixture, component: fixture.componentInstance, createScholar, updateScholar, getScholarById, notificationService, navigate };
}

const VALID_MODEL = {
  ...emptyScholarForm(),
  firstName: 'Ana',
  lastName: 'Popescu',
  schoolId: '1',
  grade: 3,
  dateOfBirth: '2016-01-01',
};

describe('ScholarFormComponent', () => {
  describe('validation', () => {
    it('requires name, school, grade and birth date, and leaves parents/schedule optional', async () => {
      const { component } = await setup();

      expect(component.scholarForm().valid()).toBe(false);
      expect(component.scholarForm.firstName().errors()[0].message).toBe('First Name is required.');
      expect(component.scholarForm.lastName().errors()[0].message).toBe('Last Name is required.');
      expect(component.scholarForm.schoolId().errors()[0].message).toBe('School is required.');
      expect(component.scholarForm.grade().errors()[0].message).toBe('Grade is required.');
      expect(component.scholarForm.dateOfBirth().errors()[0].message).toBe('Birth Date is required.');
      expect(component.scholarForm.motherPhoneNumber().valid()).toBe(true);
      expect(component.scholarForm.pickUpSchedule.monday().valid()).toBe(true);

      component.model.set(VALID_MODEL);
      expect(component.scholarForm().valid()).toBe(true);
    });

    it('accepts grade 0 (a valid grade, not "empty") and rejects values outside 0-12', async () => {
      const { component } = await setup();

      component.model.set({ ...VALID_MODEL, grade: 0 });
      expect(component.scholarForm.grade().valid()).toBe(true);

      for (const grade of [-1, 13]) {
        component.model.set({ ...VALID_MODEL, grade });
        expect(component.scholarForm.grade().errors()[0].message).toBe('Grade must be between 0 and 12.');
      }
    });

    it('rejects a future or unparseable birth date', async () => {
      const { component } = await setup();

      component.model.set({ ...VALID_MODEL, dateOfBirth: '2999-01-01' });
      expect(component.scholarForm.dateOfBirth().errors()[0].message).toBe(
        'Please enter a valid date (not in the future).',
      );

      component.model.set({ ...VALID_MODEL, dateOfBirth: 'not-a-date' });
      expect(component.scholarForm.dateOfBirth().invalid()).toBe(true);
    });

    it('rejects names over 100 characters and malformed parent phone numbers', async () => {
      const { component } = await setup();

      component.model.set({
        ...VALID_MODEL,
        firstName: 'x'.repeat(101),
        fatherPhoneNumber: 'call me',
      });

      expect(component.scholarForm.firstName().errors()[0].message).toBe(
        "First Name can't exceed 100 characters.",
      );
      expect(component.scholarForm.fatherPhoneNumber().errors()[0].message).toBe('Not a valid phone number.');
    });
  });

  describe('create mode', () => {
    it('does not call the API and reports the error count when the form is invalid', async () => {
      const { fixture, component, createScholar } = await setup();

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(createScholar).not.toHaveBeenCalled();
      expect(component.invalidSummary()).toBe(
        'The form has 5 errors. Please correct the highlighted fields.',
      );
    });

    it('creates the scholar, notifies, and navigates to the saved scholar', async () => {
      const { fixture, createScholar, updateScholar, notificationService, navigate } = await setup();
      fixture.componentInstance.model.set(VALID_MODEL);

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(updateScholar).not.toHaveBeenCalled();
      expect(createScholar).toHaveBeenCalledTimes(1);
      const sent = (createScholar.mock.calls as unknown as Scholar[][])[0][0];
      expect(sent).toMatchObject({
        id: '00000000-0000-0000-0000-000000000000',
        schoolId: 1, // the <select>'s string, converted back to the API's number
        grade: 3,
        motherFirstName: null, // blank optional text becomes null
      });
      expect(notificationService.show).toHaveBeenCalledWith('Scholar created successfully!');
      expect(navigate).toHaveBeenCalledWith(['/scholars', 'saved-id']);
    });

    it('shows the API error and stays on the page when saving fails', async () => {
      const { fixture, notificationService, navigate } = await setup({ saveResult: 'error' });
      fixture.componentInstance.model.set(VALID_MODEL);

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(notificationService.show).toHaveBeenCalledWith(
        'Failed to create scholar. createScholar failed: Invalid phone number.',
        'error',
      );
      expect(navigate).not.toHaveBeenCalled();
    });
  });

  describe('edit mode', () => {
    it('loads the scholar into the form, mapping ids/dates to strings and nulls to blanks', async () => {
      const { component, getScholarById } = await setup({ routeId: 'scholar-1' });

      expect(getScholarById).toHaveBeenCalledWith('scholar-1');
      expect(component.isEditMode()).toBe(true);
      expect(component.model()).toMatchObject({
        firstName: 'Ana',
        schoolId: '2',
        grade: 0,
        dateOfBirth: '2016-01-01',
        motherFirstName: 'Maria',
        motherLastName: '',
        fatherPhoneNumber: '',
        pickUpSchedule: { monday: '12:00', tuesday: '', friday: '' },
      });
    });

    it('notifies and leaves the form blank when the scholar fails to load', async () => {
      const { component, notificationService } = await setup({
        routeId: 'scholar-1',
        loadResult: 'error',
      });

      expect(notificationService.show).toHaveBeenCalledWith(
        'Failed to load scholar. Check console for details.',
        'error',
      );
      expect(component.model()).toEqual(emptyScholarForm());
    });

    it('updates (not creates) the scholar under its existing id', async () => {
      const { fixture, createScholar, updateScholar, notificationService } = await setup({ routeId: 'scholar-1' });

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(createScholar).not.toHaveBeenCalled();
      expect((updateScholar.mock.calls as unknown as Scholar[][])[0][0].id).toBe('scholar-1');
      expect(notificationService.show).toHaveBeenCalledWith('Scholar updated successfully!');
    });
  });

  describe('template wiring', () => {
    it('writes typed/selected DOM input through [formField] into the model', async () => {
      const { fixture, component } = await setup();
      const el: HTMLElement = fixture.nativeElement;
      const input = (id: string) => el.querySelector<HTMLInputElement>(`#${id}`)!;

      // Signal Forms listens for `input` on every native control, <select> included
      // (browsers fire `input` on a select as well as `change`).
      const set = (control: HTMLInputElement | HTMLSelectElement, value: string) => {
        control.value = value;
        control.dispatchEvent(new Event('input'));
      };

      set(input('firstName'), 'Ana');
      set(input('grade'), '3');
      set(input('dateOfBirth'), '2016-01-01');
      set(input('monday'), '12:30');
      set(el.querySelector<HTMLSelectElement>('#schoolId')!, '2');
      await fixture.whenStable();

      expect(component.model()).toMatchObject({
        firstName: 'Ana',
        grade: 3, // number input -> number, not "3"
        dateOfBirth: '2016-01-01',
        schoolId: '2',
        pickUpSchedule: { monday: '12:30' },
      });
    });

    it('renders all five weekday time inputs and the mother/father fields', async () => {
      const { fixture } = await setup();
      const el: HTMLElement = fixture.nativeElement;

      for (const day of ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']) {
        expect(el.querySelector(`input[type="time"]#${day}`)).not.toBeNull();
      }
      expect(el.querySelectorAll('input[type="tel"]').length).toBe(2);
    });
  });

  describe('mapping', () => {
    it('round-trips a scholar through toFormModel/toScholar', async () => {
      const roundTripped = toScholar(toFormModel(EXISTING), EXISTING.id);

      expect(roundTripped).toMatchObject({
        id: 'scholar-1',
        schoolId: 2,
        grade: 0,
        motherFirstName: 'Maria',
        motherLastName: null,
      });
      expect(roundTripped.dateOfBirth.toISOString().substring(0, 10)).toBe('2016-01-01');
    });
  });
});
