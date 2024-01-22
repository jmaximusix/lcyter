use serde_json::json;
use warp::Filter;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    let client_id = std::env::var("CLIENT_ID").expect("CLIENT_ID not set");
    let domain = std::env::var("DOMAIN").expect("DOMAIN not set");

    let files = warp::fs::dir("public");
    let index = warp::path::end().and(warp::fs::file("public/index.html"));
    let access = warp::path("access").and(warp::fs::file("public/access.html"));
    let login = warp::path("login").map(|| warp::reply::html("ok"));
    let client_info = warp::path("client-info").map(move || {
        warp::reply::json(&json!({
            "client_id": client_id,
            "redirect_uri": format!("https://{}/access", domain)
        }))
    });
    let res_404 = warp::any()
        .map(|| warp::reply::with_status("404 Unlucky", warp::http::StatusCode::NOT_FOUND));
    let routes = index
        .or(client_info)
        .or(login)
        .or(access)
        .or(files)
        .or(res_404);
    warp::serve(routes).run(([0, 0, 0, 0], 5500)).await;
}
