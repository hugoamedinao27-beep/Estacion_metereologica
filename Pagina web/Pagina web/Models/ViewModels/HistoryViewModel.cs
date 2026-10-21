using EstacionMeteorologica.Models;

namespace EstacionMeteorologica.Models.ViewModels;

public class HistoryViewModel
{
    public List<Reading> Readings { get; set; } = new();
    public ThresholdConfig Config { get; set; } = new();
    public bool FirebaseConfigured { get; set; }
}
