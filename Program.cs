using EstacionMeteorologica.Services;

var builder = WebApplication.CreateBuilder(args);

// MVC: vistas Razor + controladores
builder.Services.AddControllersWithViews();

// Cache de memoria (umbrales de Firebase)
builder.Services.AddMemoryCache();

// Cliente HTTP para consumir la API REST de Firebase Realtime Database
builder.Services.AddHttpClient<IFirebaseService, FirebaseService>(client =>
{
    client.Timeout = TimeSpan.FromSeconds(10);
});

// Logica de negocio pura (sin dependencias) -> testeable y reutilizable
builder.Services.AddSingleton<AlertCalculator>();

// Servicio en segundo plano que simula las lecturas del sensor (DHT22)
builder.Services.AddHostedService<DataSimulationService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseRouting();
app.UseAuthorization();

app.MapStaticAssets();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}")
    .WithStaticAssets();

app.Run();
