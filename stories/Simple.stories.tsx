import type { Meta, StoryObj } from '@storybook/react';
import { AppButton } from '../src/index';

const meta: Meta<typeof AppButton> = {
  title: 'Core/AppButton',
  component: AppButton,
};
export default meta;

type Story = StoryObj<typeof AppButton>;

export const Primary: Story = {
  args: { label: 'Hello Button' },
};

export const Disabled: Story = {
  args: { label: 'Disabled', disabled: true },
};

// Storybook play test (interaction test)
import { within, userEvent, expect } from '@storybook/test';

export const Clickable: Story = {
  args: { label: 'Click Me' },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const btn = await canvas.getByRole('button', { name: /click me/i });
    await step('click once', async () => {
      await userEvent.click(btn);
      expect(btn).toBeInTheDocument();
    });
  },
};
