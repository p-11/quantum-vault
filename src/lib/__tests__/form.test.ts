import { vi } from 'vitest';
import { getFormProps, preventDefault, stopPropagation } from '@/lib/form';

const makeKeyboardEvent = (key: string) =>
  ({ key }) as unknown as Parameters<
    ReturnType<typeof getFormProps>['onKeyDown']
  >[0];

const makeFormEvent = () =>
  ({
    preventDefault: vi.fn()
  }) as unknown as Parameters<ReturnType<typeof getFormProps>['onSubmit']>[0];

describe('getFormProps', () => {
  describe('onKeyDown', () => {
    it('calls onClose when the Escape key is pressed', () => {
      const onClose = vi.fn();
      const { onKeyDown } = getFormProps({ onClose });

      onKeyDown(makeKeyboardEvent('Escape'));

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for other keys', () => {
      const onClose = vi.fn();
      const { onKeyDown } = getFormProps({ onClose });

      onKeyDown(makeKeyboardEvent('Enter'));

      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not throw when onClose is not provided and Escape is pressed', () => {
      const { onKeyDown } = getFormProps({});
      expect(() => onKeyDown(makeKeyboardEvent('Escape'))).not.toThrow();
    });
  });

  describe('onSubmit', () => {
    it('calls preventDefault and the onSubmit handler', () => {
      const onSubmit = vi.fn();
      const formProps = getFormProps({ onSubmit });
      const event = makeFormEvent();

      formProps.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('does not call the onSubmit handler when isDisabled is true', () => {
      const onSubmit = vi.fn();
      const formProps = getFormProps({ onSubmit, isDisabled: true });
      const event = makeFormEvent();

      formProps.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not call the onSubmit handler when isPending is true', () => {
      const onSubmit = vi.fn();
      const formProps = getFormProps({ onSubmit, isPending: true });
      const event = makeFormEvent();

      formProps.onSubmit(event);

      expect(event.preventDefault).toHaveBeenCalledTimes(1);
      expect(onSubmit).not.toHaveBeenCalled();
    });

    it('does not throw when onSubmit is not provided', () => {
      const formProps = getFormProps({});
      const event = makeFormEvent();
      expect(() => formProps.onSubmit(event)).not.toThrow();
    });
  });
});

describe('preventDefault', () => {
  it('calls preventDefault on the event before the handler', () => {
    const calls: string[] = [];
    const event = {
      preventDefault: vi.fn(() => calls.push('prevent'))
    };
    const handler = vi.fn(() => calls.push('handler'));

    preventDefault(handler)(event as never);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
    expect(calls).toEqual(['prevent', 'handler']);
  });

  it('calls preventDefault even when no handler is provided', () => {
    const event = { preventDefault: vi.fn() };
    preventDefault()(event as never);
    expect(event.preventDefault).toHaveBeenCalledTimes(1);
  });
});

describe('stopPropagation', () => {
  it('calls stopPropagation on the event before the handler', () => {
    const calls: string[] = [];
    const event = {
      stopPropagation: vi.fn(() => calls.push('stop'))
    };
    const handler = vi.fn(() => calls.push('handler'));

    stopPropagation(handler)(event as never);

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith(event);
    expect(calls).toEqual(['stop', 'handler']);
  });

  it('calls stopPropagation even when no handler is provided', () => {
    const event = { stopPropagation: vi.fn() };
    stopPropagation()(event as never);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
