import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the Blue Slate shell and core navigation", async () => {
    render(<App />);

    expect(await screen.findByText("CommandWizard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "CLI" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
  });

  it("opens the CLI import surface", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("CommandWizard");
    await user.click(screen.getByRole("button", { name: "CLI" }));

    expect(screen.getByRole("heading", { name: "Managed script commands" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Choose Script" })).toBeInTheDocument();
  });

  it("clears pasted import help text", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("CommandWizard");
    await user.click(screen.getByRole("button", { name: "Import" }));
    const helpText = screen.getByRole("textbox", { name: "Pasted Help Text" }) as HTMLTextAreaElement;
    await user.type(helpText, "Usage: hf OPTIONS");

    expect(helpText.value).toBe("Usage: hf OPTIONS");
    await user.click(screen.getByRole("button", { name: "Clear" }));
    expect(helpText.value).toBe("");
  });

  it("saves a manually entered library command", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("CommandWizard");
    await user.click(screen.getByRole("button", { name: "Library" }));
    await user.type(screen.getByRole("textbox", { name: "Command" }), "rsync --version");
    await user.click(screen.getByRole("button", { name: "Save Manual" }));

    expect(await screen.findByText("rsync --version")).toBeInTheDocument();
  });
});
