import { UdemyUser } from "../types";
import { logger } from "../utils/logger";

const UDEMY_BASE_URL = "https://www.udemy.com/api-2.0";

export class UdemyAPI {
  constructor(private authToken: string) {}

  private async request(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${UDEMY_BASE_URL}${endpoint}`;

    const headers = new Headers(options.headers || {});
    headers.set("Authorization", `Bearer ${this.authToken}`);
    headers.set("Content-Type", "application/json");
    headers.set("User-Agent", "coupon-finder/0.1.0");

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(
        `Udemy API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  }

  async getMe(): Promise<UdemyUser> {
    logger.debug("Fetching user info from Udemy API...");
    const data = await this.request("/users/me/");

    return {
      id: data.id,
      name: data.display_name || data.first_name || "User",
      email: data.email,
      title: data.title,
    };
  }

  async getCourseInfo(courseId: number): Promise<any> {
    return this.request(`/courses/${courseId}/`);
  }

  async isEnrolled(courseId: number): Promise<boolean> {
    try {
      await this.request(`/users/me/subscribed-courses/${courseId}/`);
      return true;
    } catch {
      return false;
    }
  }
}

export async function createUdemyAPI(authToken: string): Promise<UdemyAPI> {
  const api = new UdemyAPI(authToken);

  // Verify token is valid
  try {
    await api.getMe();
    logger.debug("Udemy API initialized successfully");
  } catch (error) {
    throw new Error(
      `Invalid Udemy session. Please log in to Udemy in your browser: https://www.udemy.com/join/login-popup/`
    );
  }

  return api;
}
