using System;
using System.Linq;
using CommandWizard.Models;
using Tomlyn;
using Tomlyn.Model;

namespace CommandWizard.Services
{
    public static class SchemaSerialization
    {
        public static ToolSchema Parse(string tomlText)
        {
            var result = Toml.Parse(tomlText);
            if (result.HasErrors)
            {
                var error = string.Join("; ", result.Diagnostics.Select(d => d.ToString()));
                throw new InvalidOperationException(error);
            }

            var model = Toml.ToModel(tomlText) as TomlTable
                ?? throw new InvalidOperationException("Schema root is not a table.");

            var schema = new ToolSchema();

            if (model.TryGetValue("tool", out var toolObj) && toolObj is TomlTable toolTable)
            {
                schema.Name = toolTable.TryGetValue("name", out var nameObj) ? nameObj?.ToString() ?? "" : "";
                schema.Description = toolTable.TryGetValue("description", out var descObj) ? descObj?.ToString() ?? "" : "";
                schema.Notes = toolTable.TryGetValue("notes", out var notesObj) ? notesObj?.ToString() ?? "" : "";
                schema.ExecutablePath = toolTable.TryGetValue("executable_path", out var pathObj) ? pathObj?.ToString() ?? "" : "";
                schema.InstalledName = toolTable.TryGetValue("installed_name", out var installedObj) ? installedObj?.ToString() ?? "" : "";
            }

            if (model.TryGetValue("actions", out var actionsObj) && actionsObj is TomlTableArray actionsArray)
            {
                foreach (TomlTable actionTable in actionsArray)
                {
                    var action = new SchemaAction
                    {
                        Name = actionTable.TryGetValue("name", out var nameObj) ? nameObj?.ToString() ?? "" : "",
                        Description = actionTable.TryGetValue("description", out var descObj) ? descObj?.ToString() ?? "" : ""
                    };

                    if (actionTable.TryGetValue("arguments", out var actionArgsObj) && actionArgsObj is TomlTableArray actionArgsArray)
                    {
                        foreach (TomlTable argTable in actionArgsArray)
                        {
                            var argument = ParseArgument(argTable);
                            action.Arguments.Add(argument);
                        }
                    }

                    if (actionTable.TryGetValue("parameters", out var actionParamsObj) && actionParamsObj is TomlTableArray actionParamsArray)
                    {
                        foreach (TomlTable paramTable in actionParamsArray)
                        {
                            var parameter = ParseParameter(paramTable);
                            if (!string.IsNullOrWhiteSpace(parameter.Name))
                                action.Parameters.Add(parameter);
                        }
                    }

                    if (!string.IsNullOrWhiteSpace(action.Name))
                    {
                        schema.Actions.Add(action);
                    }
                }
            }

            if (model.TryGetValue("arguments", out var argsObj) && argsObj is TomlTableArray argsArray)
            {
                foreach (TomlTable argTable in argsArray)
                {
                    schema.Arguments.Add(ParseArgument(argTable));
                }
            }

            if (model.TryGetValue("parameters", out var paramsObj) && paramsObj is TomlTableArray paramsArray)
            {
                foreach (TomlTable paramTable in paramsArray)
                {
                    var parameter = ParseParameter(paramTable);
                    if (!string.IsNullOrWhiteSpace(parameter.Name))
                    {
                        schema.Parameters.Add(parameter);
                    }
                }
            }

            if (model.TryGetValue("tags", out var tagsObj) && tagsObj is TomlTableArray tagsArray)
            {
                foreach (TomlTable tagTable in tagsArray)
                {
                    var tag = new SchemaTag
                    {
                        Name = tagTable.TryGetValue("name", out var nameObj) ? nameObj?.ToString() ?? "" : "",
                        Color = tagTable.TryGetValue("color", out var colorObj) ? colorObj?.ToString() ?? "#7A7A7A" : "#7A7A7A"
                    };
                    if (!string.IsNullOrWhiteSpace(tag.Name))
                    {
                        schema.Tags.Add(tag);
                    }
                }
            }

            if (string.IsNullOrWhiteSpace(schema.Name))
            {
                throw new InvalidOperationException("Schema is missing tool.name.");
            }

            return schema;
        }

        private static SchemaArgument ParseArgument(TomlTable argTable)
        {
            var styleText = argTable.TryGetValue("value_style", out var vsObj) ? vsObj?.ToString() ?? "" : "";
            return new SchemaArgument
            {
                Flag = argTable.TryGetValue("flag", out var flagObj) ? flagObj?.ToString() ?? "" : "",
                Long = argTable.TryGetValue("long", out var longObj) ? longObj?.ToString() ?? "" : "",
                Description = argTable.TryGetValue("description", out var descObj) ? descObj?.ToString() ?? "" : "",
                Type = argTable.TryGetValue("type", out var typeObj) ? typeObj?.ToString() ?? "boolean" : "boolean",
                ValueStyle = ParseValueStyle(styleText)
            };
        }

        private static SchemaParameter ParseParameter(TomlTable paramTable)
        {
            var required = true;
            if (paramTable.TryGetValue("required", out var reqObj) && bool.TryParse(reqObj?.ToString(), out var req))
                required = req;
            return new SchemaParameter
            {
                Name = paramTable.TryGetValue("name", out var nameObj) ? nameObj?.ToString() ?? "" : "",
                Type = paramTable.TryGetValue("type", out var typeObj) ? typeObj?.ToString() ?? "string" : "string",
                Required = required
            };
        }

        private static ArgumentValueStyle ParseValueStyle(string s) => s.ToLowerInvariant() switch
        {
            "equals" or "equals_separated" => ArgumentValueStyle.EqualsSeparated,
            "attached" => ArgumentValueStyle.Attached,
            _ => ArgumentValueStyle.SpaceSeparated
        };

        public static string Serialize(ToolSchema schema)
        {
            var root = new TomlTable();
            var toolTable = new TomlTable
            {
                ["name"] = schema.Name,
                ["description"] = schema.Description
            };
            if (!string.IsNullOrWhiteSpace(schema.Notes))
            {
                toolTable["notes"] = schema.Notes;
            }
            if (!string.IsNullOrWhiteSpace(schema.ExecutablePath))
            {
                toolTable["executable_path"] = schema.ExecutablePath;
            }
            if (!string.IsNullOrWhiteSpace(schema.InstalledName))
            {
                toolTable["installed_name"] = schema.InstalledName;
            }
            root["tool"] = toolTable;

            if (schema.Actions.Count > 0)
            {
                var actions = new TomlTableArray();
                foreach (var action in schema.Actions)
                {
                    var actionEntry = new TomlTable
                    {
                        ["name"] = action.Name,
                        ["description"] = action.Description
                    };
                    if (action.Arguments.Count > 0)
                    {
                        var actionArgs = new TomlTableArray();
                        foreach (var arg in action.Arguments)
                            actionArgs.Add(SerializeArgument(arg));
                        actionEntry["arguments"] = actionArgs;
                    }
                    if (action.Parameters.Count > 0)
                    {
                        var actionParams = new TomlTableArray();
                        foreach (var param in action.Parameters)
                            actionParams.Add(new TomlTable { ["name"] = param.Name, ["type"] = param.Type, ["required"] = param.Required });
                        actionEntry["parameters"] = actionParams;
                    }
                    actions.Add(actionEntry);
                }
                root["actions"] = actions;
            }

            if (schema.Arguments.Count > 0)
            {
                var args = new TomlTableArray();
                foreach (var arg in schema.Arguments)
                    args.Add(SerializeArgument(arg));
                root["arguments"] = args;
            }

            if (schema.Parameters.Count > 0)
            {
                var parameters = new TomlTableArray();
                foreach (var param in schema.Parameters)
                {
                    parameters.Add(new TomlTable
                    {
                        ["name"] = param.Name,
                        ["type"] = param.Type,
                        ["required"] = param.Required
                    });
                }
                root["parameters"] = parameters;
            }

            if (schema.Tags.Count > 0)
            {
                var tags = new TomlTableArray();
                foreach (var tag in schema.Tags)
                {
                    var entry = new TomlTable
                    {
                        ["name"] = tag.Name,
                        ["color"] = string.IsNullOrWhiteSpace(tag.Color) ? "#7A7A7A" : tag.Color
                    };
                    tags.Add(entry);
                }
                root["tags"] = tags;
            }

            return Toml.FromModel(root);
        }

        private static TomlTable SerializeArgument(SchemaArgument arg)
        {
            var entry = new TomlTable
            {
                ["flag"] = arg.Flag,
                ["description"] = arg.Description,
                ["type"] = arg.Type
            };
            if (!string.IsNullOrWhiteSpace(arg.Long))
                entry["long"] = arg.Long;
            if (arg.ValueStyle != ArgumentValueStyle.SpaceSeparated)
            {
                entry["value_style"] = arg.ValueStyle switch
                {
                    ArgumentValueStyle.EqualsSeparated => "equals",
                    ArgumentValueStyle.Attached => "attached",
                    _ => "space"
                };
            }
            return entry;
        }
    }
}
