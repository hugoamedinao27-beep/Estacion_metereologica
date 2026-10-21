using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using EstacionMeteorologica.Models;
using Microsoft.Extensions.Caching.Memory;

namespace EstacionMeteorologica.Services;

/// <summary>
/// Cliente HTTP que consume la API REST de Firebase Realtime Database
/// (https://firebase.google.com/docs/database/rest).
///
/// Estructura en la base de datos:
///   /config    -> umbrales de alerta (ThresholdConfig)
///   /readings  -> lecturas del sensor indexadas por clave cronológica
///
/// La URL base se inyecta desde la configuración (appsettings.json en local
/// y Application Settings de Azure App Service en producción).
/// </summary>
public class FirebaseService : IFirebaseService
{
    private readonly HttpClient _http;
    private readonly ILogger<FirebaseService> _logger;
    private readonly IMemoryCache _cache;
    private readonly string? _baseUrl;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        Converters = { new JsonStringEnumConverter() }
    };

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_baseUrl);

    public FirebaseService(HttpClient http, IConfiguration configuration,
        ILogger<FirebaseService> logger, IMemoryCache cache)
    {
        _http = http;
        _logger = logger;
        _cache = cache;
        _baseUrl = configuration["Firebase:DatabaseUrl"]?.TrimEnd('/');
    }

    public async Task<ThresholdConfig> GetConfigAsync()
    {
        if (!IsConfigured) return new ThresholdConfig();

        return await _cache.GetOrCreateAsync("thresholds", async entry =>
        {
            entry.AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(5);
            try
            {
                var json = await _http.GetStringAsync($"{_baseUrl}/config.json");
                var config = JsonSerializer.Deserialize<ThresholdConfig>(json, JsonOptions);
                return config ?? new ThresholdConfig();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "No se pudo leer /config de Firebase; se usan los umbrales por defecto.");
                return new ThresholdConfig();
            }
        }) ?? new ThresholdConfig();
    }

    public async Task SaveConfigAsync(ThresholdConfig config)
    {
        if (!IsConfigured) return;

        var content = new StringContent(
            JsonSerializer.Serialize(config, JsonOptions), Encoding.UTF8, "application/json");

        var response = await _http.PatchAsync($"{_baseUrl}/config.json", content);
        response.EnsureSuccessStatusCode();
        _cache.Remove("thresholds");
        _logger.LogInformation("Umbrales actualizados en Firebase.");
    }

    public async Task<Reading?> GetLatestReadingAsync()
    {
        var readings = await GetRecentReadingsAsync(1);
        return readings.Count > 0 ? readings[^1] : null;
    }

    public async Task<List<Reading>> GetRecentReadingsAsync(int limit)
    {
        var result = new List<Reading>();
        if (!IsConfigured) return result;

        // orderBy="$key": las claves son cronológicas, limitToLast obtiene las más recientes.
        var url = $"{_baseUrl}/readings.json?orderBy=%22%24key%22&limitToLast={limit}";
        var json = await _http.GetStringAsync(url);

        var dict = JsonSerializer.Deserialize<Dictionary<string, Reading>>(json, JsonOptions);
        if (dict is null) return result;

        foreach (var pair in dict.OrderBy(p => p.Key))
            result.Add(pair.Value);

        return result;
    }

    public async Task AddReadingAsync(Reading reading)
    {
        if (!IsConfigured) return;

        // Clave cronológica (estilo push key) para ordenar y evitar colisiones.
        var key = $"{DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()}-{Guid.NewGuid().ToString("N")[..6]}";
        var body = JsonSerializer.Serialize(reading, JsonOptions);
        var content = new StringContent(body, Encoding.UTF8, "application/json");

        var response = await _http.PutAsync($"{_baseUrl}/readings/{key}.json", content);

        if (!response.IsSuccessStatusCode)
            _logger.LogWarning("Firebase devolvió {Status} al registrar la lectura.", response.StatusCode);
    }
}
