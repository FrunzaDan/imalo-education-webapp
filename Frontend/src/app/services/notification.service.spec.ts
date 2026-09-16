import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;

  beforeEach(() => {
    vi.useFakeTimers();
    service = new NotificationService();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no notifications', () => {
    expect(service.notifications()).toEqual([]);
  });

  it('adds a notification with an incrementing id and default type/duration', () => {
    service.show('Saved');

    const [notification] = service.notifications();
    expect(notification).toMatchObject({ id: 1, message: 'Saved', type: 'success' });
  });

  it('assigns distinct, increasing ids across calls', () => {
    service.show('First');
    service.show('Second');

    const ids = service.notifications().map((n) => n.id);
    expect(ids).toEqual([1, 2]);
  });

  it('supports the error type', () => {
    service.show('Failed', 'error');

    expect(service.notifications()[0].type).toBe('error');
  });

  it('auto-dismisses after the given duration, leaving other notifications intact', () => {
    service.show('Short-lived', 'success', 1000);
    service.show('Long-lived', 'success', 5000);

    vi.advanceTimersByTime(1000);

    expect(service.notifications().map((n) => n.message)).toEqual(['Long-lived']);
  });

  it('dismiss(id) removes only the matching notification', () => {
    service.show('Keep me', 'success', 5000);
    service.show('Remove me', 'success', 5000);
    const idToRemove = service.notifications()[1].id;

    service.dismiss(idToRemove);

    expect(service.notifications().map((n) => n.message)).toEqual(['Keep me']);
  });

  it('dismiss on an unknown id is a no-op', () => {
    service.show('Stays', 'success', 5000);

    expect(() => service.dismiss(9999)).not.toThrow();
    expect(service.notifications().length).toBe(1);
  });
});
