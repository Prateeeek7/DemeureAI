def current_user(request: Request, services: Services = Depends(get_services)) -> SessionUser:
    token = request.cookies.get(SESSION_COOKIE)
    user = services.auth.verify_token(token) if token else None
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not signed in or session expired")
    return user


def require_roles(*roles: str) -> Callable[..., SessionUser]:
    def dependency(user: SessionUser = Depends(current_user)) -> SessionUser:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Your role cannot perform this action")
        return user
    return dependency
