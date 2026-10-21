namespace EstacionMeteorologica.Models;

/// <summary>
/// Una lectura del sensor (equivalente al DHT22 del prototipo).
/// Se serializa a/desde JSON de Firebase Realtime Database.
/// </summary>
public class Reading
{
    public double Temperature { get; set; }
    public double Humidity { get; set; }
    public DateTime Timestamp { get; set; }
    public AlertState State { get; set; }
}
