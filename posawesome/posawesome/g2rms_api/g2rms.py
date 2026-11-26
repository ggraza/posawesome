import requests
import json
import frappe
import base64
from werkzeug.wrappers import Response
from frappe.utils import now_datetime, get_url


def log_error(title, error):
    frappe.log_error(
        title=title,
        message=str(error)
    )


@frappe.whitelist(allow_guest=True)
def generate_token_secure(api_key, api_secret, app_key):
    try:
        try:
            app_key = base64.b64decode(app_key).decode("utf-8")
        except Exception:
            log_error("Base64 Decode Error", e)
            return Response(json.dumps({"message": "Security Parameters are not valid"}), status=401, mimetype="application/json")

        client_data = frappe.db.get_value(
            "OAuth Client",
            {"app_name": app_key},
            ["client_id", "client_secret", "user"],
            as_dict=True
        )

        if not client_data:
            return Response(json.dumps({"message": "Security Parameters are not valid"}), status=401, mimetype="application/json")

        url = f"{get_url()}/api/method/frappe.integrations.oauth2.get_token"

        payload = {
            "username": api_key,
            "password": api_secret,
            "grant_type": "password",
            "client_id": client_data.client_id,
            "client_secret": client_data.client_secret
        }

        response = requests.post(url, data=payload)

        if response.status_code == 200:
            result_data = json.loads(response.text)
            return Response(json.dumps({"data": result_data}), status=200, mimetype="application/json")
        else:
            return Response(json.dumps({"message": "Invalid Login"}), status=401, mimetype="application/json")

    except Exception as e:
        log_error("Token Generation Error", f"Error in generate_token_secure: {str(e)}")
        return Response(json.dumps({"message": "Internal Server Error"}), status=500, mimetype="application/json")


@frappe.whitelist(allow_guest=True)
def generate_token_for_offline_user(api_key, api_secret, app_key):
    return generate_token_secure(api_key, api_secret, app_key)


@frappe.whitelist(allow_guest=True)
def create_refresh_token(refresh_token):
    try:
        url = f"{get_url()}/api/method/frappe.integrations.oauth2.get_token"
        payload = f"grant_type=refresh_token&refresh_token={refresh_token}"
        headers = {"Content-Type": "application/x-www-form-urlencoded"}

        response = requests.post(url, headers=headers, data=payload)

        if response.status_code == 200:
            try:
                message_json = json.loads(response.text)
                new_token = {
                    "access_token": message_json.get("access_token"),
                    "expires_in": message_json.get("expires_in"),
                    "token_type": message_json.get("token_type"),
                    "scope": message_json.get("scope"),
                    "refresh_token": message_json.get("refresh_token"),
                }
                return Response(json.dumps({"data": new_token}), status=200, mimetype="application/json")
            except Exception as e:
                log_error("Token Refresh Decoding Error", e)
                return Response(json.dumps({"message": f"Error decoding token: {str(e)}"}), status=401, mimetype="application/json")

        return Response(json.dumps({"message": "Refresh token invalid"}), status=401, mimetype="application/json")

    except Exception as e:
        log_error("Token Refresh Error", e)
        return Response(json.dumps({"message": "Internal Server Error"}), status=500, mimetype="application/json")


@frappe.whitelist(allow_guest=False)
def generate_token_secure_for_users(username, password, app_key):
    try:
        frappe.log_error(
            title="Login Attempt",
            message=f"Username: {username} | App Key: {app_key}"
        )

        try:
            app_key = base64.b64decode(app_key).decode("utf-8")
        except Exception:
            return Response(
                json.dumps({"message": "Security Parameters are not valid", "user_count": 0}),
                status=401,
                mimetype="application/json"
            )

        client_data = frappe.db.get_value(
            "OAuth Client",
            {"app_name": app_key},
            ["client_id", "client_secret", "user"],
            as_dict=True
        )

        if not client_data:
            return Response(
                json.dumps({"message": "Security Parameters are not valid", "user_count": 0}),
                status=401,
                mimetype="application/json"
            )

        url = f"{get_url()}/api/method/frappe.integrations.oauth2.get_token"

        payload = {
            "username": username,
            "password": password,
            "grant_type": "password",
            "client_id": client_data.client_id,
            "client_secret": client_data.client_secret
        }

        response = requests.post(url, data=payload)

        user_info = frappe.get_list(
            "User",
            fields=["name as id", "full_name", "mobile_no as phone", "email"],
            filters={"name": ["like", username]},
        )

        offline_user = frappe.get_value(
            "Offline POS User",
            {"user": username},
            ["pos_profile", "company"],
            as_dict=True
        )

        if not offline_user:
            return Response(
                json.dumps({"message": "Offline POS User not configured.", "user_count": 0}),
                status=401,
                mimetype="application/json"
            )

        if response.status_code == 200:
            response_data = json.loads(response.text)
            result = {
                "token": response_data,
                "user": user_info[0] if user_info else {},
                "time": str(now_datetime()),
                "company": offline_user.company,
                "pos_profile": offline_user.pos_profile
            }
            return Response(
                json.dumps({"data": result}),
                status=200,
                mimetype="application/json"
            )
        else:
            return Response(
                json.dumps({"message": "Invalid Login", "user_count": 0}),
                status=401,
                mimetype="application/json"
            )

    except Exception as e:
        log_error("Token Generation Error", f"Error in generate_token_secure_for_users: {str(e)}")
        return Response(
            json.dumps({"message": "Internal Server Error", "user_count": 0}),
            status=500,
            mimetype="application/json"
        )

#when I postman
#https://rms.g2virtu.com/api/method/posawesome.posawesome.g2rms_api.g2rms.generate_token_secure?api_key=developer@g2virtu.com&api_secret=g2virtu.com1&app_key=RzJfUk1TX09mZmxpbmU=
#then response like
#{
#    "message": "Internal Server Error"
#}
#where the problem, can you fix it please