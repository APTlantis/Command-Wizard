using System.Collections.Generic;
using System.Linq;
using CommandWizard.Models;
using CommandWizard.ViewModels;

namespace CommandWizard.Services
{
    public static class CommandBuilder
    {
        public static List<CommandPart> BuildParts(ToolSchemaViewModel tool, SchemaAction? action)
        {
            var parts = new List<CommandPart>();

            var toolName = tool.CommandName;
            if (!string.IsNullOrWhiteSpace(toolName))
            {
                parts.Add(new CommandPart
                {
                    Role = CommandPartRole.Tool,
                    Token = toolName,
                    IsFixed = true
                });
            }

            if (action != null && !string.IsNullOrWhiteSpace(action.Name))
            {
                parts.Add(new CommandPart
                {
                    Role = CommandPartRole.Action,
                    Token = action.Name
                });
            }

            foreach (var option in tool.Options)
            {
                if (option.IsBoolean)
                {
                    if (option.IsSelected && !string.IsNullOrWhiteSpace(option.DisplayName))
                    {
                        parts.Add(new CommandPart
                        {
                            Role = CommandPartRole.Argument,
                            Token = option.DisplayName,
                            SourceArgument = option.Argument
                        });
                    }
                }
                else if (!string.IsNullOrWhiteSpace(option.Value) && !string.IsNullOrWhiteSpace(option.DisplayName))
                {
                    var flagPart = new CommandPart
                    {
                        Role = CommandPartRole.Argument,
                        Token = option.DisplayName,
                        SourceArgument = option.Argument
                    };
                    var valuePart = new CommandPart
                    {
                        Role = CommandPartRole.ArgumentValue,
                        Token = option.Value.Trim(),
                        SourceArgument = option.Argument,
                        LinkedValueId = flagPart.Id
                    };
                    flagPart.LinkedValueId = valuePart.Id;
                    parts.Add(flagPart);
                    parts.Add(valuePart);
                }
            }

            foreach (var parameter in tool.Parameters)
            {
                if (!string.IsNullOrWhiteSpace(parameter.Value))
                {
                    parts.Add(new CommandPart
                    {
                        Role = CommandPartRole.Parameter,
                        Token = parameter.Value.Trim(),
                        SourceParameter = parameter.Parameter
                    });
                }
            }

            return parts;
        }

        public static string TokensFromParts(IEnumerable<CommandPartViewModel> parts)
        {
            var tokens = new List<string>();
            CommandPartViewModel? lastFlag = null;

            foreach (var part in parts)
            {
                if (part.Role == CommandPartRole.ArgumentValue)
                {
                    var style = lastFlag?.Part.SourceArgument?.ValueStyle ?? ArgumentValueStyle.SpaceSeparated;
                    switch (style)
                    {
                        case ArgumentValueStyle.EqualsSeparated when tokens.Count > 0 && !string.IsNullOrWhiteSpace(part.Value):
                            tokens[^1] += "=" + part.Value;
                            break;
                        case ArgumentValueStyle.Attached when tokens.Count > 0 && !string.IsNullOrWhiteSpace(part.Value):
                            tokens[^1] += part.Value;
                            break;
                        default:
                            if (!string.IsNullOrWhiteSpace(part.Value))
                                tokens.Add(part.Value);
                            break;
                    }
                    lastFlag = null;
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(part.Value))
                        tokens.Add(part.Value);

                    lastFlag = part.Role == CommandPartRole.Argument ? part : null;
                }
            }

            return string.Join(" ", tokens);
        }

        public static string BuildCommand(ToolSchemaViewModel? tool, SchemaAction? action)
        {
            if (tool == null) return string.Empty;

            var rawParts = BuildParts(tool, action);
            var tokens = new List<string>();
            CommandPart? lastFlag = null;

            foreach (var part in rawParts)
            {
                if (string.IsNullOrWhiteSpace(part.Token) && part.Role != CommandPartRole.ArgumentValue)
                {
                    lastFlag = null;
                    continue;
                }

                if (part.Role == CommandPartRole.ArgumentValue)
                {
                    var style = lastFlag?.SourceArgument?.ValueStyle ?? ArgumentValueStyle.SpaceSeparated;
                    switch (style)
                    {
                        case ArgumentValueStyle.EqualsSeparated when tokens.Count > 0 && !string.IsNullOrWhiteSpace(part.Token):
                            tokens[^1] += "=" + part.Token;
                            break;
                        case ArgumentValueStyle.Attached when tokens.Count > 0 && !string.IsNullOrWhiteSpace(part.Token):
                            tokens[^1] += part.Token;
                            break;
                        default:
                            if (!string.IsNullOrWhiteSpace(part.Token))
                                tokens.Add(part.Token);
                            break;
                    }
                    lastFlag = null;
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(part.Token))
                        tokens.Add(part.Token);
                    lastFlag = part.Role == CommandPartRole.Argument ? part : null;
                }
            }

            return string.Join(" ", tokens);
        }
    }
}
