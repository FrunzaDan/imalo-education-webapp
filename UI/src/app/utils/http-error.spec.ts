import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom, of, throwError } from 'rxjs';
import { catchHttpError, extractHttpErrorMessage } from './http-error';

describe('extractHttpErrorMessage', () => {
  it('reports an offline/unreachable server for status 0', () => {
    const error = new HttpErrorResponse({ status: 0 });
    expect(extractHttpErrorMessage(error)).toBe('Could not reach the server. It may be offline.');
  });

  it('flattens a ModelState-style validation-errors dict', () => {
    const error = new HttpErrorResponse({
      status: 400,
      error: { errors: { FirstName: ['Required'], Grade: ['Out of range', 'Must be an integer'] } },
    });

    expect(extractHttpErrorMessage(error)).toBe(
      'Validation errors - Required; Out of range; Must be an integer',
    );
  });

  it('falls back to a plain server message when there is no validation dict', () => {
    const error = new HttpErrorResponse({ status: 404, error: { message: 'Scholar not found.' } });
    expect(extractHttpErrorMessage(error)).toBe('Scholar not found.');
  });

  it('falls back to a generic message when the server sends neither shape', () => {
    const error = new HttpErrorResponse({ status: 500 });
    expect(extractHttpErrorMessage(error)).toBe('Request failed (500). Please try again.');
  });
});

describe('catchHttpError', () => {
  it('passes successful values through unchanged', async () => {
    const result = await firstValueFrom(of('ok').pipe(catchHttpError('op')));
    expect(result).toBe('ok');
  });

  it('rethrows an Error prefixed with the operation name and extracted message', async () => {
    const error = new HttpErrorResponse({ status: 404, error: { message: 'Scholar not found.' } });

    await expect(
      firstValueFrom(throwError(() => error).pipe(catchHttpError('getScholarById id=123'))),
    ).rejects.toThrow('getScholarById id=123 failed: Scholar not found.');
  });
});
