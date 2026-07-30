import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  it("renders the Blue Slate shell and core navigation", async () => {
    render(<App />);

    expect(await screen.findByText("CommandWizard")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Builder" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Schema" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument();
  });
});
