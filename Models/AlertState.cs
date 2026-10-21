namespace EstacionMeteorologica.Models;

/// <summary>
/// Estados de alerta de la maquina de estados del sistema.
/// </summary>
public enum AlertState
{
    Frio,
    Normal,
    Precaucion,
    Calor,
    Critico
}
