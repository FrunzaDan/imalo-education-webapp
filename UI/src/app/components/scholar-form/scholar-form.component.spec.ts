import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { ScholarFormComponent } from './scholar-form.component';
import { ScholarsService } from '../../services/scholars.service';
import { SchoolsService } from '../../services/schools.service';
import { emptyScholarForm, isScholarFormDirty, toFormModel, toScholar } from './scholar-form';
import type { Scholar } from '../../interfaces/scholar';
import type { School } from '../../interfaces/school';

// TestBed spec for the Signal Forms version of ScholarFormComponent. Follows the
// pattern of attendance-per-scholar.component.spec.ts: standalone component,
// zoneless, plain-object service fakes with synchronous observables. Business
// rules go through the model signal; one test drives real DOM events to prove
// the [formField] bindings (text / select / number / date / time) still wire up.

const SCHOOLS: School[] = [
  { schoolId: 1, name: 'Test School', color: '#336699', lunchPrice: 15, transportPrice: 10 },
  { schoolId: 2, name: 'Other School', color: '#993366', lunchPrice: 12, transportPrice: 8 },
];

const EXISTING: Scholar = {
  scholarId: 'scholar-1',
  firstName: 'Ana',
  lastName: 'Popescu',
  schoolId: 2,
  grade: 0,
  birthDate: '2016-01-01',
  motherFirstName: 'Maria',
  motherLastName: null,
  motherPhoneNumber: '0722111222',
  fatherFirstName: null,
  fatherLastName: null,
  fatherPhoneNumber: null,
  pickupSchedule: { monday: '12:00', tuesday: null, wednesday: null, thursday: null, friday: null },
};

interface SetupOptions {
  routeId?: string | null;
  saveResult?: 'success' | 'error';
  loadResult?: 'success' | 'error';
}

async function setup(options: SetupOptions = {}) {
  const saved: Scholar = { ...EXISTING, scholarId: 'saved-id' };
  const createScholar = vi.fn(() =>
    options.saveResult === 'error'
      ? throwError(
          () =>
            new HttpErrorResponse({
              status: 400,
              error: { status: 400, errors: { MotherPhoneNumber: ['Invalid phone number.'] } },
            }),
        )
      : of(saved),
  );
  const updateScholar = vi.fn(() => of(saved));
  const getScholarById = vi.fn(() =>
    options.loadResult === 'error'
      ? throwError(
          () =>
            new HttpErrorResponse({
              status: 404,
              error: { status: 404, title: 'Scholar not found.', detail: 'Scholar with ID scholar-1 not found.' },
            }),
        )
      : of(EXISTING),
  );
  const navigate = vi.fn().mockResolvedValue(true);

  TestBed.configureTestingModule({
    imports: [ScholarFormComponent],
    providers: [
      provideZonelessChangeDetection(),
      { provide: Router, useValue: { navigate } },
      { provide: ScholarsService, useValue: { createScholar, updateScholar, getScholarById } },
      { provide: SchoolsService, useValue: { getSchools: () => of(SCHOOLS) } },
    ],
  });

  const fixture: ComponentFixture<ScholarFormComponent> = TestBed.createComponent(ScholarFormComponent);
  // The route's :scholarId reaches the component as an input (withComponentInputBinding()).
  if (options.routeId) fixture.componentRef.setInput('scholarId', options.routeId);
  fixture.detectChanges();
  await fixture.whenStable(); // let the scholar rxResource load in edit mode
  return { fixture, component: fixture.componentInstance, createScholar, updateScholar, getScholarById, navigate };
}

const VALID_MODEL = {
  ...emptyScholarForm(),
  firstName: 'Ana',
  lastName: 'Popescu',
  schoolId: '1',
  grade: 3,
  birthDate: '2016-01-01',
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
      expect(component.scholarForm.birthDate().errors()[0].message).toBe('Birth Date is required.');
      expect(component.scholarForm.motherPhoneNumber().valid()).toBe(true);
      expect(component.scholarForm.pickupSchedule.monday().valid()).toBe(true);

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

      component.model.set({ ...VALID_MODEL, birthDate: '2999-01-01' });
      expect(component.scholarForm.birthDate().errors()[0].message).toBe(
        'Please enter a valid date (not in the future).',
      );

      component.model.set({ ...VALID_MODEL, birthDate: 'not-a-date' });
      expect(component.scholarForm.birthDate().invalid()).toBe(true);
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

    it('creates the scholar and navigates to the saved scholar', async () => {
      const { fixture, createScholar, updateScholar, navigate } = await setup();
      fixture.componentInstance.model.set(VALID_MODEL);

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(updateScholar).not.toHaveBeenCalled();
      expect(createScholar).toHaveBeenCalledTimes(1);
      const sent = (createScholar.mock.calls as unknown as Scholar[][])[0][0];
      expect(sent).toMatchObject({
        scholarId: '00000000-0000-0000-0000-000000000000',
        schoolId: 1, // the <select>'s string, converted back to the API's number
        grade: 3,
        motherFirstName: null, // blank optional text becomes null
      });
      expect(navigate).toHaveBeenCalledWith(['/scholars', 'saved-id']);
    });

    it('shows the API error inline and stays on the page when saving fails', async () => {
      const { fixture, component, navigate } = await setup({ saveResult: 'error' });
      component.model.set(VALID_MODEL);

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(component.saveError()).toBe('Invalid phone number.');
      expect(fixture.nativeElement.querySelector('.app-alert')?.textContent).toContain(
        'Invalid phone number.',
      );
      expect(component.hasUnsavedChanges()).toBe(true);
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
        birthDate: '2016-01-01',
        motherFirstName: 'Maria',
        motherLastName: '',
        fatherPhoneNumber: '',
        pickupSchedule: { monday: '12:00', tuesday: '', friday: '' },
      });
    });

    it('shows the load error in place of the form when the scholar fails to load', async () => {
      const { fixture, component } = await setup({
        routeId: 'scholar-1',
        loadResult: 'error',
      });
      fixture.detectChanges();
      const el: HTMLElement = fixture.nativeElement;

      expect(component.loadError()).toBe('Scholar with ID scholar-1 not found.');
      expect(el.querySelector('[role="alert"]')?.textContent).toContain('not found');
      expect(el.querySelector('form')).toBeNull();
    });

    it('updates (not creates) the scholar under its existing id', async () => {
      const { fixture, createScholar, updateScholar } = await setup({ routeId: 'scholar-1' });

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(createScholar).not.toHaveBeenCalled();
      const sent = (updateScholar.mock.calls as unknown as Scholar[][])[0][0];
      expect(sent.scholarId).toBe('scholar-1');
      // Blank time inputs go out as null ("no pickup"), not ''.
      expect(sent.pickupSchedule).toEqual({
        monday: '12:00',
        tuesday: null,
        wednesday: null,
        thursday: null,
        friday: null,
      });
    });
  });

  describe('unsaved changes', () => {
    it('reports none on a blank create form, and some once a field is typed', async () => {
      const { component } = await setup();

      expect(component.hasUnsavedChanges()).toBe(false);
      component.model.update((model) => ({ ...model, firstName: 'Ana' }));
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('compares against the loaded scholar, including the pickup schedule', async () => {
      const { component } = await setup({ routeId: 'scholar-1' });

      expect(component.hasUnsavedChanges()).toBe(false);
      component.model.update((model) => ({
        ...model,
        pickupSchedule: { ...model.pickupSchedule, friday: '13:00' },
      }));
      expect(component.hasUnsavedChanges()).toBe(true);
    });

    it('clears once the scholar is saved, so leaving does not prompt', async () => {
      const { fixture, component } = await setup();
      component.model.set(VALID_MODEL);

      fixture.nativeElement.querySelector('form').dispatchEvent(new Event('submit'));
      await fixture.whenStable();

      expect(component.hasUnsavedChanges()).toBe(false);
    });

    it('asks the browser to confirm a reload or tab close only while there are unsaved changes', async () => {
      const { component } = await setup();
      const clean = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      component.onBeforeUnload(clean);
      expect(clean.defaultPrevented).toBe(false);

      component.model.set(VALID_MODEL);
      const dirty = new Event('beforeunload', { cancelable: true }) as BeforeUnloadEvent;
      component.onBeforeUnload(dirty);
      expect(dirty.defaultPrevented).toBe(true);
    });

    it('isScholarFormDirty treats a value typed and then put back as unchanged', () => {
      const baseline = toFormModel(EXISTING);

      expect(isScholarFormDirty({ ...baseline, firstName: 'Ana' }, baseline)).toBe(false);
      expect(isScholarFormDirty({ ...baseline, grade: 4 }, baseline)).toBe(true);
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
      set(input('birthDate'), '2016-01-01');
      set(input('monday'), '12:30');
      set(el.querySelector<HTMLSelectElement>('#schoolId')!, '2');
      await fixture.whenStable();

      expect(component.model()).toMatchObject({
        firstName: 'Ana',
        grade: 3, // number input -> number, not "3"
        birthDate: '2016-01-01',
        schoolId: '2',
        pickupSchedule: { monday: '12:30' },
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
      const roundTripped = toScholar(toFormModel(EXISTING), EXISTING.scholarId);

      expect(roundTripped).toMatchObject({
        scholarId: 'scholar-1',
        schoolId: 2,
        grade: 0,
        motherFirstName: 'Maria',
        motherLastName: null,
      });
      expect(roundTripped.birthDate).toBe('2016-01-01');
    });
  });
});
