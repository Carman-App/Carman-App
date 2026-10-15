import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import { router } from "expo-router";
import Login from "@/app/(auth)/login";
import { __resetSessionForTests } from "@/services/api";
import { mockFetch, session } from "./helpers";

jest.mock("react-native-safe-area-context", () => {
  const { View } = jest.requireActual("react-native");
  return { SafeAreaView: View, useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) };
});

beforeEach(() => __resetSessionForTests());

describe("Login screen", () => {
  it("validates input before calling the API", async () => {
    const calls = mockFetch(() => ({ status: 200, body: session("r") }));
    await render(<Login />);
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Enter a valid email address")).toBeTruthy();
    expect(calls).toHaveLength(0);
  });

  it("signs a broker in and opens the seller dashboard", async () => {
    mockFetch(() => ({ status: 200, body: session("r2", "BROKER") }));
    await render(<Login />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "otieno@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "Safari2026");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/(seller)/dashboard"));
  });

  it("shows the API's error message for wrong credentials", async () => {
    mockFetch(() => ({ status: 401, body: { error: { code: "INVALID_CREDENTIALS", message: "Email or password is incorrect" } } }));
    await render(<Login />);
    await fireEvent.changeText(screen.getByLabelText("Email"), "otieno@example.com");
    await fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    await fireEvent.press(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByText("Email or password is incorrect")).toBeTruthy();
  });
});
