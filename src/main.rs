use serde::{Deserialize, Serialize};
use serde_json::json;
use std::convert::Infallible;
use std::fmt::Display;
use std::io::Read;
use std::{collections::HashMap, fs::File};
use warp::http::StatusCode;
use warp::{filters::BoxedFilter, Filter};

const USERS_PATH: &str = "user_data/";

#[derive(Debug)]
struct InvalidAuth;
impl warp::reject::Reject for InvalidAuth {}

trait Validate {
    fn is_valid(&self) -> bool;
}

#[derive(Serialize, Deserialize, Eq, PartialEq, Hash, Clone, Debug)]
struct Identifier(String);

impl Display for Identifier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.0)
    }
}

impl Validate for Identifier {
    fn is_valid(&self) -> bool {
        let username_regex = regex::Regex::new(r"^[a-zA-Z0-9._-]{3,32}$").unwrap();
        username_regex.is_match(&self.0)
    }
}

struct Hashes(String);

impl Hashes {
    fn from_request_body_raw(bytes: bytes::Bytes) -> Self {
        Self(String::from_utf8_lossy(&bytes).to_string())
    }
    fn line_count(&self) -> usize {
        self.0.lines().count()
    }
    fn save_to_file(&self, id: &Identifier) {
        let filename = format!("{USERS_PATH}hashes/{id}.txt");
        std::fs::write(filename, &self.0).unwrap();
    }
}

impl Validate for Hashes {
    fn is_valid(&self) -> bool {
        (self.line_count() > 0)
            && self
                .0
                .lines()
                .all(|l| l.len() == 64 && l.chars().all(|c| c.is_ascii_hexdigit()))
    }
}

#[derive(Deserialize)]
struct ClientAuth {
    identifier: Identifier,
    password: String,
}

impl Validate for ClientAuth {
    fn is_valid(&self) -> bool {
        if !self.identifier.is_valid() {
            return false;
        }
        let mut users = read_users().unwrap();
        if let Some(hash) = users.get(&self.identifier) {
            // existing identifier
            bcrypt::verify(&self.password, hash).unwrap()
        } else {
            // new identifier
            users.insert(
                self.identifier.clone(),
                bcrypt::hash(&self.password, 8).unwrap(),
            );
            save_users(&users).unwrap();
            true
        }
    }
}

type Users = HashMap<Identifier, String>;

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    let client_id = std::env::var("CLIENT_ID").expect("CLIENT_ID not set");
    let domain = std::env::var("DOMAIN").expect("DOMAIN not set");

    let files = warp::fs::dir("public");
    let index = warp::path::end().and(warp::fs::file("public/index.html"));
    let access = warp::path("access").and(warp::fs::file("public/access.html"));
    let client_info = warp::path("client-info").map(move || {
        warp::reply::json(&json!({
            "client_id": client_id,
            "redirect_uri": format!("https://{}/access", domain)
        }))
    });
    let routes = index
        .or(client_info)
        .or(access)
        .or(upload_route())
        .or(delete_route())
        .or(compare_route())
        .or(files)
        .recover(handle_rejection);
    warp::serve(routes).run(([0, 0, 0, 0], 5500)).await;
}

fn upload_route() -> BoxedFilter<(impl warp::Reply,)> {
    warp::path("upload")
        .and(warp::post())
        .and(valid_credentials())
        .and(warp::body::content_length_limit(1024 * 32))
        .and(warp::body::bytes())
        .map(|id: Identifier, bytes: bytes::Bytes| {
            let hashes = Hashes::from_request_body_raw(bytes);
            if hashes.is_valid() {
                println!("Valid body of length {}", hashes.line_count());
                hashes.save_to_file(&id);
                warp::reply::with_status(
                    warp::reply::json(&json!({
                        "status" : "ok",
                        "message" : "Upload successful!"
                    })),
                    warp::http::StatusCode::OK,
                )
            } else {
                println!("Invalid body");
                warp::reply::with_status(
                    warp::reply::json(&json!({
                        "status" : "error",
                        "message" : "Bad request!"
                    })),
                    warp::http::StatusCode::BAD_REQUEST,
                )
            }
        })
        .boxed()
}

fn delete_route() -> BoxedFilter<(impl warp::Reply,)> {
    warp::path("delete")
        .and(warp::delete().or(warp::patch()).unify())
        .and(warp::method())
        .and(valid_credentials())
        .map(|method: warp::http::Method, id: Identifier| {
            println!("Deleting hashes of {}", id);
            let filename = format!("{USERS_PATH}hashes/{}.txt", id);
            let _ = std::fs::remove_file(filename);
            let mut message = "Data deleted successfully!";
            if method == warp::http::Method::DELETE {
                println!("Deleting account of {}", id);
                message = "Account deleted successfully!";
                let mut users = read_users().unwrap();
                users.remove(&id);
                save_users(&users).unwrap();
            }
            warp::reply::with_status(
                warp::reply::json(&json!({
                    "status" : "ok",
                    "message" : message
                })),
                warp::http::StatusCode::OK,
            )
        })
        .boxed()
}

fn compare_route() -> BoxedFilter<(impl warp::Reply,)> {
    warp::path("compare")
        .and(warp::path::param())
        .map(|id: String| {
            let filename = format!("{USERS_PATH}hashes/{}.txt", id);
            if let Ok(hashes) = std::fs::read_to_string(filename) {
                warp::reply::with_status(hashes, warp::http::StatusCode::OK)
            } else {
                warp::reply::with_status(
                    String::from("User not found!"),
                    warp::http::StatusCode::NOT_FOUND,
                )
            }
        })
        .boxed()
}

fn valid_credentials() -> BoxedFilter<(Identifier,)> {
    warp::query::<ClientAuth>()
        .and_then(|auth: ClientAuth| async move {
            if auth.is_valid() {
                Ok(auth.identifier)
            } else {
                Err(warp::reject::custom(InvalidAuth))
            }
        })
        .boxed()
}

async fn handle_rejection(err: warp::Rejection) -> Result<impl warp::reply::Reply, Infallible> {
    let code;
    let message;
    if err.is_not_found() {
        code = StatusCode::NOT_FOUND;
        message = "404 Unlucky";
    } else if let Some(InvalidAuth) = err.find() {
        code = StatusCode::UNAUTHORIZED;
        message = "Password is wrong - User exists already!";
    } else {
        eprintln!("Unhandled rejection: {:?}", err);
        code = StatusCode::INTERNAL_SERVER_ERROR;
        message = "Internal Server Error";
    }
    Ok(warp::reply::with_status(
        warp::reply::json(&json!({
            "status" : "error",
            "message" : message
        })),
        code,
    ))
}

fn read_users() -> Result<Users, Box<dyn std::error::Error>> {
    let mut contents = String::from("{}");
    let filename = format!("{USERS_PATH}credentials.json");
    if let Ok(mut file) = File::open(filename) {
        contents.clear();
        file.read_to_string(&mut contents).ok();
    }
    Ok(serde_json::from_str::<Users>(&contents)?)
}

fn save_users(users: &Users) -> Result<(), std::io::Error> {
    let filename = format!("{USERS_PATH}credentials.json");
    std::fs::write(filename, serde_json::to_string_pretty(&users)?.as_bytes())
}
