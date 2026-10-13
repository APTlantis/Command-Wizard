import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";
import { useCommandWizardStore } from "./stores/useCommandWizardStore";
import { emptySchema } from "./lib/schema";
import { act } from "@testing-library/react";

beforeEach(() => useCommandWizardStore.setState(useCommandWizardStore.getInitialState(), true));

describe("App", () => {
  it("protects unsaved Library drafts when leaving the browser page", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "rsync", level: 1 });
    act(() => { useCommandWizardStore.getState().openLibraryEntry(); useCommandWizardStore.getState().updateLibraryDraft({ command: "keep this draft" }); });
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
  it("renders the Blue Slate shell and core navigation", async () => {
    render(<App />);

    expect(await screen.findByText("CommandWizard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "CLI" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "PowerShell" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Linux (WSL)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
  });

  it("shows preview only in Builder and hides it in empty categories", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("CommandWizard");
    await screen.findByRole("heading", { name: "rsync", level: 1 });
    expect(screen.getByText("Command Preview")).toBeInTheDocument();
    expect(screen.queryByText("Not ready.")).not.toBeInTheDocument();
    expect(screen.queryByText("Needs Review")).not.toBeInTheDocument();
    for (const name of ["Import", "Schema", "Library", "Evidence"]) {
      await user.click(screen.getByRole("button", { name }));
      expect(screen.queryByText("Command Preview")).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Builder" }));
    expect(screen.getByText("Command Preview")).toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "PowerShell" }));
    expect(screen.queryByText("Command Preview")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "rsync", level: 1 })).not.toBeInTheDocument();
  });

  it("shows schema health in the rail and command panel", async () => {
    render(<App />);

    await screen.findByRole("heading", { name: "rsync", level: 1 });
    expect(screen.getAllByText("Schema").length).toBeGreaterThan(0);
    expect(screen.getByText("Executable")).toBeInTheDocument();
    expect(screen.getByText("Arguments")).toBeInTheDocument();
    expect(screen.getByText("Required Parameters")).toBeInTheDocument();
    expect(screen.queryByText("Not ready.")).not.toBeInTheDocument();
  });

  it("hides empty parameter sections and spans an odd final parameter", async () => {
    render(<App />);
    await screen.findByRole("heading", { name: "rsync", level: 1 });
    const schema = { ...emptySchema(), name: "pandoc" };
    act(() => {
      useCommandWizardStore.setState({ schemas: [schema] });
      useCommandWizardStore.getState().selectSchema("pandoc");
    });
    expect(screen.queryByTestId("builder-parameters")).not.toBeInTheDocument();
    schema.parameters = ["first", "second", "third"].map((name) => ({ name, type: "string", required: true }));
    act(() => useCommandWizardStore.getState().selectSchema("pandoc"));
    const inputs = screen.getByTestId("builder-parameters").querySelectorAll("input");
    expect(inputs).toHaveLength(3);
    expect(inputs[2].parentElement).toHaveClass("md:col-span-2");
    expect(screen.getByText("Parameters").compareDocumentPosition(screen.getByText("Options")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
    await user.click(screen.getByRole("button", { name: "New Command" }));
    await user.type(screen.getByRole("textbox", { name: "Command" }), "rsync --version");
    await user.click(screen.getByRole("button", { name: "Save Command" }));

    expect(await screen.findByRole("textbox", { name: "Command" })).toHaveValue("rsync --version");
    expect(screen.getByRole("button", { name: /New command Unassigned/ })).toBeInTheDocument();
  });
});
