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

  it("shows schema health in the rail and command panel", async () => {
    render(<App />);

    expect(await screen.findByText("Valid")).toBeInTheDocument();
    expect(screen.getAllByText("Schema").length).toBeGreaterThan(0);
    expect(screen.getByText("Executable")).toBeInTheDocument();
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    expect(screen.getByText("Required Parameters")).toBeInTheDocument();
    expect(screen.getByText("Command")).toBeInTheDocument();
  });

  it("edits provenance metadata in Schema Studio", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("CommandWizard");
    await user.click(screen.getByRole("button", { name: "Schema" }));
    await user.type(screen.getByLabelText("Version"), "2.1");
    await user.type(screen.getByLabelText("Author"), "Herb");

    expect(document.body.textContent).toContain("[metadata]");
    expect(document.body.textContent).toContain('version = "2.1"');
    expect(document.body.textContent).toContain('author = "Herb"');
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
