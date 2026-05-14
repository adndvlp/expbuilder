import type { Page, Locator } from "@playwright/test";

export class RegisterPage {
  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole("heading", { name: /Sign Up/i });
  }

  get emailInput(): Locator {
    return this.page.locator('input[type="email"]');
  }

  get passwordInput(): Locator {
    return this.page.locator('input[type="password"]').first();
  }

  get confirmPasswordInput(): Locator {
    return this.page.locator('input[type="password"]').nth(1);
  }

  get submitButton(): Locator {
    return this.page.getByRole("button", { name: /Create Account/i });
  }

  get signInLink(): Locator {
    return this.page.getByRole("link", { name: /Sign In/i });
  }

  get successMessage(): Locator {
    return this.page.getByText(/Account created/i);
  }

  get errorMessage(): Locator {
    return this.page.locator('[style*="color: red"]');
  }

  async goto() {
    await this.page.goto("/#/auth/register");
  }

  async register(email: string, password: string, confirmPassword?: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.confirmPasswordInput.fill(confirmPassword ?? password);
    await this.submitButton.click();
  }
}
