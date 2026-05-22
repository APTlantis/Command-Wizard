using System;

namespace CommandWizard.Models
{
    public enum CommandPartRole
    {
        Tool,
        Action,
        Argument,
        ArgumentValue,
        Parameter
    }

    public sealed class CommandPart
    {
        public Guid Id { get; } = Guid.NewGuid();
        public CommandPartRole Role { get; init; }
        public string Token { get; set; } = string.Empty;
        public bool IsFixed { get; init; }
        public SchemaArgument? SourceArgument { get; init; }
        public SchemaParameter? SourceParameter { get; init; }
        public Guid? LinkedValueId { get; set; }
    }
}
