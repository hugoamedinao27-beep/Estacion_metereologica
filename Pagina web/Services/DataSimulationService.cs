using EstacionMeteorologica.Models;

namespace EstacionMeteorologica.Services;

/// <summary>
/// Servicio en segundo plano que simula el sensor DHT22 del prototipo físico:
/// cada pocos segundos genera una lectura de temperatura/humedad (random walk
/// realista), calcula el estado con las reglas de negocio y la persiste en
/// Firebase vía la API REST.
///
/// Nota de arquitectura: en el dispositivo real, el ESP32 enviaría estas
/// lecturas al mismo nodo /readings de Firebase; el resto del sistema
/// (dashboard, historial, alertas) no cambia.
/// </summary>
public class DataSimulationService : BackgroundService
{
    private readonly IFirebaseService _firebase;
    private readonly AlertCalculator _calculator;
    private readonly ILogger<DataSimulationService> _logger;
    private readonly int _intervalSeconds;

    // Estado interno de la simulación (random walk).
    private double _temperature = 22.0;
    private double _humidity = 54.0;
    private readonly Random _random = new();

    public DataSimulationService(IFirebaseService firebase, AlertCalculator calculator,
        IConfiguration configuration, ILogger<DataSimulationService> logger)
    {
        _firebase = firebase;
        _calculator = calculator;
        _logger = logger;
        _intervalSeconds = Math.Clamp(
            configuration.GetValue("Firebase:SimulationIntervalSeconds", 8), 2, 120);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation(
            "Simulador de sensor iniciado (cada {Interval}s). Firebase configurado: {Ok}",
            _intervalSeconds, _firebase.IsConfigured);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var reading = NextReading();
                await _firebase.AddReadingAsync(reading);

                if (_logger.IsEnabled(LogLevel.Debug))
                    _logger.LogDebug("Lectura simulada: {Temp:F1} °C, {Hum:F0} % -> {State}",
                        reading.Temperature, reading.Humidity, reading.State);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al simular y registrar la lectura.");
            }

            await Task.Delay(TimeSpan.FromSeconds(_intervalSeconds), stoppingToken);
        }
    }

    private Reading NextReading()
    {
        // Random walk con deriva suave y límites físicos plausibles.
        _temperature = Math.Clamp(_temperature + (_random.NextDouble() - 0.48) * 0.6, 12.0, 38.0);
        _humidity = Math.Clamp(_humidity + (_random.NextDouble() - 0.5) * 1.5, 30.0, 85.0);

        var config = _firebase.GetConfigAsync().GetAwaiter().GetResult();

        return new Reading
        {
            Temperature = Math.Round(_temperature, 1),
            Humidity = Math.Round(_humidity, 0),
            Timestamp = DateTime.UtcNow,
            State = _calculator.Calculate(_temperature, config)
        };
    }
}
