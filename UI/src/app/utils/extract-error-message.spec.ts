import { HttpErrorResponse } from '@angular/common/http';
import { extractErrorMessage } from './extract-error-message';

describe('extractErrorMessage', () => {
  it('reports an unreachable server for status 0', () => {
    const error = new HttpErrorResponse({ status: 0 });

    expect(extractErrorMessage(error)).toBe('Could not reach the server. It may be offline.');
  });

  it("joins a validation problem's per-field messages", () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: {
        title: 'One or more validation errors occurred.',
        status: 400,
        errors: {
          FirstName: ['The FirstName field is required.'],
          Grade: ['Grade must be between 0 and 12.'],
        },
      },
    });

    expect(extractErrorMessage(error)).toBe(
      'The FirstName field is required. Grade must be between 0 and 12.',
    );
  });

  it("uses a problem's detail when there are no validation errors", () => {
    const error = new HttpErrorResponse({
      status: 404,
      error: { title: 'Scholar not found.', status: 404, detail: 'Scholar with ID 123 not found.' },
    });

    expect(extractErrorMessage(error)).toBe('Scholar with ID 123 not found.');
  });

  it("falls back to a problem's title when it has no detail", () => {
    const error = new HttpErrorResponse({
      status: 500,
      error: { title: 'An error occurred while processing your request.', status: 500 },
    });

    expect(extractErrorMessage(error)).toBe('An error occurred while processing your request.');
  });

  it('names the failed action when the response has no problem body', () => {
    const error = new HttpErrorResponse({ status: 502 });

    expect(extractErrorMessage(error)).toBe('Request failed (502). Please try again.');
    expect(extractErrorMessage(error, 'Failed to save attendance')).toBe(
      'Failed to save attendance (502). Please try again.',
    );
  });
});
