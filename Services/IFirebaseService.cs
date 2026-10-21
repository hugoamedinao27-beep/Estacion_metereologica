using EstacionMeteorologica.Models;

namespace EstacionMeteorologica.Services;

/// <summary>
/// Contrato de acceso a los datos persistidos en Firebase Realtime Database.
/// </summary>
public interface IFirebaseService
{
    /// <summary>Indica si la URL de Firebase está configurada.</summary>
    bool IsConfigured { get; }

    Task<ThresholdConfig> GetConfigAsync();
    Task SaveConfigAsync(ThresholdConfig config);
    Task<Reading?> GetLatestReadingAsync();
    Task<List<Reading>> GetRecentReadingsAsync(int limit);
    Task AddReadingAsync(Reading reading);
}
