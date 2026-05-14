import type { Page, Locator } from "@playwright/test";

export class LoginPage {
  constructor(readonly page: Page) {}

  get heading(): Locator {
    return this.page.getByRole("heading", { name: /Sign In/i });
  }

  get emailInput(): Locator {
    return this.page.locator('input[type="email"]');
  }

  get passwordInput(): Locator {
    return this.page.locator('input[type="password"]');
  }

  get submitButton(): Locator {
    return this.page.getByRole("button", { name: /Sign In/i });
  }

  get signUpLink(): Locator {
    return this.page.getByRole("link", { name: /Sign Up/i });
  }

  get backToHomeLink(): Locator {
    return this.page.getByRole("link", { name: /Back to Home/i });
  }

  get successMessage(): Locator {
    return this.page.getByText(/Login successful/i);
  }

  get errorMessage(): Locator {
    return this.page.locator('[style*="color: red"]');
  }

  async goto() {
    await this.page.goto("/#/auth/login");
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
