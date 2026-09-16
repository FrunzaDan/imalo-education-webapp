import { ConfirmModalService } from './confirm-modal.service';

describe('ConfirmModalService', () => {
  let service: ConfirmModalService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new ConfirmModalService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no open modal', () => {
    expect(service.state()).toBeNull();
    expect(service.closing()).toBe(false);
  });

  it('confirm() populates state with defaults for confirm/cancel text and variant', async () => {
    void service.confirm('Delete this scholar?');

    expect(service.state()).toMatchObject({
      message: 'Delete this scholar?',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      variant: 'default',
    });
  });

  it('confirm() honors overridden options', async () => {
    void service.confirm('Really delete?', {
      title: 'Danger',
      confirmText: 'Delete',
      cancelText: 'Keep',
      variant: 'danger',
    });

    expect(service.state()).toMatchObject({
      title: 'Danger',
      confirmText: 'Delete',
      cancelText: 'Keep',
      variant: 'danger',
    });
  });

  it('respond(true) resolves the pending promise with true', async () => {
    const pending = service.confirm('Proceed?');

    service.respond(true);

    await expect(pending).resolves.toBe(true);
  });

  it('respond(false) resolves the pending promise with false', async () => {
    const pending = service.confirm('Proceed?');

    service.respond(false);

    await expect(pending).resolves.toBe(false);
  });

  it('respond() sets closing=true immediately, then clears state after the close animation', () => {
    void service.confirm('Proceed?');
    service.respond(true);

    expect(service.closing()).toBe(true);
    expect(service.state()).not.toBeNull();

    vi.advanceTimersByTime(1000);

    expect(service.state()).toBeNull();
    expect(service.closing()).toBe(false);
  });

  it('respond() with no pending confirm() is a no-op', () => {
    expect(() => service.respond(true)).not.toThrow();
    expect(service.state()).toBeNull();
  });

  it('a second confirm() while one is pending auto-resolves the first as false', async () => {
    const first = service.confirm('First question?');
    const second = service.confirm('Second question?');

    await expect(first).resolves.toBe(false);
    expect(service.state()?.message).toBe('Second question?');

    service.respond(true);
    await expect(second).resolves.toBe(true);
  });
});
