namespace EstacionMeteorologica.Services;

using EstacionMeteorologica.Models;

/// <summary>
/// Reglas de negocio puras: a partir de una temperatura y los umbrales
/// configurados determina el estado de alerta. Sin dependencias de I/O,
/// lo que permite testearla aisladamente.
/// </summary>
public class AlertCalculator
{
    public AlertState Calculate(double temperature, ThresholdConfig config)
    {
        if (temperature < config.ColdThreshold)
            return AlertState.Frio;
        if (temperature >= config.CriticalThreshold)
            return AlertState.Critico;
        if (temperature >= config.CalorThreshold)
            return AlertState.Calor;
        if (temperature >= config.CautionThreshold)
            return AlertState.Precaucion;
        return AlertState.Normal;
    }
}
